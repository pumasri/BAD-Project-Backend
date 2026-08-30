const express = require("express");

const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

const matchInclude = {
  lostReport: { include: { category: true, images: true } },
  foundReport: { include: { category: true, images: true } },
  reviewer: { select: { id: true, fullName: true } }
};

router.use(authenticate, allowRoles("STAFF", "ADMIN"));

router.get("/", async (req, res, next) => {
  try {
    const where = {};
    if (typeof req.query.status === "string") {
      const status = req.query.status.toUpperCase();
      if (!["SUGGESTED", "CONFIRMED", "REJECTED", "CLAIMED", "RESOLVED"].includes(status)) {
        return res.status(400).json({ message: "Invalid match status" });
      }
      where.status = status;
    }
    if (typeof req.query.confidence === "string") {
      const confidence = req.query.confidence.toUpperCase();
      if (!["HIGH", "POSSIBLE"].includes(confidence)) {
        return res.status(400).json({ message: "Invalid confidence" });
      }
      where.confidence = confidence;
    }

    const matches = await prisma.matchSuggestion.findMany({
      where,
      include: matchInclude,
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }]
    });
    return res.json(matches);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const match = await prisma.matchSuggestion.findUnique({
      where: { id: req.params.id },
      include: matchInclude
    });
    if (!match) return res.status(404).json({ message: "Match not found" });
    return res.json(match);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const status = typeof req.body?.status === "string" ? req.body.status.toUpperCase() : "";
    if (!["CONFIRMED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Status must be CONFIRMED or REJECTED" });
    }

    const existing = await prisma.matchSuggestion.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Match not found" });
    if (existing.status !== "SUGGESTED") {
      return res.status(409).json({ message: "Only suggested matches can be reviewed" });
    }

    const match = await prisma.matchSuggestion.update({
      where: { id: existing.id },
      data: {
        status,
        reviewerId: req.user.id,
        reviewedAt: new Date()
      },
      include: matchInclude
    });

    await prisma.auditLog.create({
      data: {
        action: status === "CONFIRMED" ? "CONFIRM_MATCH" : "REJECT_MATCH",
        entityType: "MatchSuggestion",
        entityId: match.id,
        details: { status },
        actorUserId: req.user.id
      }
    });

    return res.json(match);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
