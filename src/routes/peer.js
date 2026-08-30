const express = require("express");
const crypto = require("node:crypto");

const prisma = require("../config/prisma");
const { createRateLimit } = require("../middleware/rateLimit");
const {
  PEER_ITEM_STATUSES,
  parsePartnerSyncPayload,
  parsePositiveLimit,
  toOutboundPeerItem,
  toPartnerSyncedItem,
  toSyncedPeerItem
} = require("../services/partnerSync");

const router = express.Router();

// Every peer endpoint uses a separately provisioned key. A partner can read
// only its own imported inventory, while the outbound feed contains no local
// user, claim, evidence, or image data.
async function authenticatePartner(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ success: false, message: "Missing API key" });
  }

  try {
    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const partner = await prisma.partnerClient.findFirst({
      where: { apiKeyHash, isActive: true }
    });

    if (!partner) {
      return res.status(401).json({ success: false, message: "Invalid API key" });
    }

    req.partner = partner;
    return next();
  } catch (error) {
    return next(error);
  }
}

router.use(authenticatePartner);
router.use(createRateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: "Too many peer API requests. Please try again shortly."
}));

// GET /api/peer/items
// A privacy-safe outbound feed that a partner can post back to its own /sync.
router.get("/items", async (req, res, next) => {
  const parsedLimit = parsePositiveLimit(req.query.limit);
  if (!parsedLimit.success) {
    return res.status(400).json({ success: false, message: parsedLimit.message });
  }

  let updatedAfter;
  if (req.query.updatedAfter !== undefined) {
    if (typeof req.query.updatedAfter !== "string" || Number.isNaN(Date.parse(req.query.updatedAfter))) {
      return res.status(400).json({ success: false, message: "updatedAfter must be an ISO-8601 date/time" });
    }
    updatedAfter = new Date(req.query.updatedAfter);
  }

  try {
    const items = await prisma.itemReport.findMany({
      where: {
        reportType: "FOUND",
        isPublic: true,
        status: { in: PEER_ITEM_STATUSES },
        ...(updatedAfter ? { updatedAt: { gt: updatedAfter } } : {})
      },
      include: { category: { select: { name: true } } },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: parsedLimit.value
    });

    return res.status(200).json({
      success: true,
      items: items.map(toOutboundPeerItem),
      count: items.length
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/peer/sync
// The request accepts only public item metadata and stores it under the sender.
router.post("/sync", async (req, res, next) => {
  const parsed = parsePartnerSyncPayload(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.message,
      issues: parsed.issues
    });
  }

  const syncedAt = new Date();
  const externalIds = parsed.data.items.map((item) => item.externalId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.partnerSyncedItem.findMany({
        where: { partnerId: req.partner.id, externalId: { in: externalIds } },
        select: { externalId: true }
      });
      const existingIds = new Set(existing.map((item) => item.externalId));
      const records = parsed.data.items.map((item) => toPartnerSyncedItem(item, req.partner.id, syncedAt));

      await Promise.all(records.map((record) => tx.partnerSyncedItem.upsert({
        where: {
          partnerId_externalId: {
            partnerId: req.partner.id,
            externalId: record.externalId
          }
        },
        create: record,
        update: {
          title: record.title,
          category: record.category,
          location: record.location,
          occurredAt: record.occurredAt,
          status: record.status,
          sourceUrl: record.sourceUrl,
          remoteUpdatedAt: record.remoteUpdatedAt,
          lastSyncedAt: record.lastSyncedAt,
          isActive: true
        }
      })));

      const createdCount = records.filter((record) => !existingIds.has(record.externalId)).length;
      const updatedCount = records.length - createdCount;
      let deactivatedCount = 0;
      if (parsed.data.mode === "SNAPSHOT") {
        const staleRecords = await tx.partnerSyncedItem.updateMany({
          where: {
            partnerId: req.partner.id,
            isActive: true,
            externalId: { notIn: externalIds }
          },
          data: { isActive: false }
        });
        deactivatedCount = staleRecords.count;
      }
      await tx.partnerSyncEvent.create({
        data: {
          operation: parsed.data.mode,
          receivedCount: records.length,
          createdCount,
          updatedCount,
          deactivatedCount,
          partnerId: req.partner.id
        }
      });

      return { createdCount, updatedCount, deactivatedCount };
    });

    return res.status(200).json({
      success: true,
      message: "Partner items were validated and synchronised",
      received: parsed.data.items.length,
      created: result.createdCount,
      updated: result.updatedCount,
      deactivated: result.deactivatedCount,
      mode: parsed.data.mode,
      syncedAt: syncedAt.toISOString()
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/peer/synced-items
// Lets a partner query the inventory it has already shared with this system.
router.get("/synced-items", async (req, res, next) => {
  const parsedLimit = parsePositiveLimit(req.query.limit);
  if (!parsedLimit.success) {
    return res.status(400).json({ success: false, message: parsedLimit.message });
  }

  const filters = { partnerId: req.partner.id, isActive: true };
  if (typeof req.query.category === "string" && req.query.category.trim()) {
    filters.category = { equals: req.query.category.trim(), mode: "insensitive" };
  }
  if (typeof req.query.location === "string" && req.query.location.trim()) {
    filters.location = { contains: req.query.location.trim(), mode: "insensitive" };
  }
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    const query = req.query.q.trim();
    filters.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { location: { contains: query, mode: "insensitive" } }
    ];
  }

  try {
    const items = await prisma.partnerSyncedItem.findMany({
      where: filters,
      orderBy: [{ remoteUpdatedAt: "desc" }, { updatedAt: "desc" }],
      take: parsedLimit.value
    });
    return res.status(200).json({
      success: true,
      items: items.map(toSyncedPeerItem),
      count: items.length
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
