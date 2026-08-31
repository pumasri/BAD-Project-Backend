const { z } = require("zod");

const PEER_ITEM_STATUSES = ["OPEN", "MATCHED", "CLAIM_IN_PROGRESS"];
const MAX_SYNC_ITEMS = 100;

const safeText = (maximumLength) => z.string()
  .trim()
  .min(1)
  .max(maximumLength);

const safeOptionalText = (maximumLength) => z.string()
  .trim()
  .min(1)
  .max(maximumLength)
  .optional();

const dateText = z.string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be an ISO-8601 date/time");

const sourceUrl = z.string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "sourceUrl must use http or https")
  .optional();

const peerItemSchema = z.object({
  externalId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/, "externalId contains unsupported characters"),
  title: safeText(160),
  category: safeOptionalText(80).nullable(),
  location: safeText(160),
  occurredAt: dateText,
  status: z.enum(PEER_ITEM_STATUSES).default("OPEN"),
  sourceUrl,
  updatedAt: dateText.optional()
}).strict();

const peerSyncSchema = z.object({
  mode: z.enum(["UPSERT", "SNAPSHOT"]).default("UPSERT"),
  items: z.array(peerItemSchema).max(MAX_SYNC_ITEMS)
}).strict().superRefine((value, context) => {
  if (value.mode === "UPSERT" && value.items.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["items"],
      message: "items must contain at least one record for UPSERT mode"
    });
  }
});

function parsePartnerSyncPayload(payload) {
  const result = peerSyncSchema.safeParse(payload);
  if (!result.success) {
    return {
      success: false,
      message: "Invalid partner sync payload",
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    };
  }

  const externalIds = new Set();
  for (const item of result.data.items) {
    if (externalIds.has(item.externalId)) {
      return {
        success: false,
        message: "Each externalId may appear only once per sync request",
        issues: [{ path: "items", message: `Duplicate externalId: ${item.externalId}` }]
      };
    }
    externalIds.add(item.externalId);
  }

  return { success: true, data: result.data };
}

function toPartnerSyncedItem(item, partnerId, syncedAt = new Date()) {
  return {
    externalId: item.externalId,
    title: item.title,
    category: item.category || null,
    location: item.location,
    occurredAt: new Date(item.occurredAt),
    status: item.status,
    sourceUrl: item.sourceUrl || null,
    remoteUpdatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
    lastSyncedAt: syncedAt,
    isActive: true,
    partnerId
  };
}

function toOutboundPeerItem(item) {
  return {
    externalId: item.id,
    title: item.title,
    category: item.category?.name || null,
    location: item.location,
    occurredAt: item.occurredAt.toISOString(),
    status: item.status,
    updatedAt: item.updatedAt.toISOString()
  };
}

function toSyncedPeerItem(item) {
  return {
    externalId: item.externalId,
    title: item.title,
    category: item.category,
    location: item.location,
    occurredAt: item.occurredAt,
    status: item.status,
    sourceUrl: item.sourceUrl,
    remoteUpdatedAt: item.remoteUpdatedAt,
    lastSyncedAt: item.lastSyncedAt
  };
}

function parsePositiveLimit(value, defaultValue = 50) {
  if (value === undefined) return { success: true, value: defaultValue };
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return { success: false, message: "limit must be a positive integer" };
  }
  const limit = Number(value);
  if (limit < 1 || limit > MAX_SYNC_ITEMS) {
    return { success: false, message: `limit must be between 1 and ${MAX_SYNC_ITEMS}` };
  }
  return { success: true, value: limit };
}

module.exports = {
  MAX_SYNC_ITEMS,
  PEER_ITEM_STATUSES,
  parsePartnerSyncPayload,
  parsePositiveLimit,
  toOutboundPeerItem,
  toPartnerSyncedItem,
  toSyncedPeerItem
};
