const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

// POST /api/claims (Student)
router.post("/", authenticate, allowRoles("STUDENT"), async (req, res, next) => {
  try {
    const { foundReportId, identifyingDetails, evidence } = req.body;

    const foundItem = await prisma.itemReport.findUnique({
      where: { id: foundReportId }
    });

    if (!foundItem) {
      return res.status(404).json({ message: "Found item not found" });
    }

    if (foundItem.reportType !== "FOUND") {
      return res.status(400).json({
        message: "Claims can only be submitted for found items"
      });
    }

    if (foundItem.status !== "OPEN" && foundItem.status !== "MATCHED") {
      return res.status(400).json({
        message: "This item is not available for a new claim"
      });
    }
    
    const claim = await prisma.claimRequest.create({
      data: {
        foundReportId,
        identifyingDetails,
        claimantUserId: req.user.id,
        status: "PENDING",
        evidence: {
          create: evidence || []
        }
      },
      include: { evidence: true }
    });
    
    // Also update item status to CLAIM_IN_PROGRESS if it's OPEN or MATCHED
    await prisma.itemReport.update({
      where: { id: foundReportId },
      data: { status: "CLAIM_IN_PROGRESS" }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "CREATE_CLAIM",
        entityType: "ClaimRequest",
        entityId: claim.id,
        actorUserId: req.user.id
      }
    });
    
    res.status(201).json(claim);
  } catch (error) {
    next(error);
  }
});

// GET /api/claims/my (Student)
router.get("/my", authenticate, allowRoles("STUDENT"), async (req, res, next) => {
  try {
    const claims = await prisma.claimRequest.findMany({
      where: { claimantUserId: req.user.id },
      include: {
        foundReport: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(claims);
  } catch (error) {
    next(error);
  }
});

// GET /api/claims (Staff)
router.get("/", authenticate, allowRoles("STAFF"), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status.toUpperCase();
    
    const claims = await prisma.claimRequest.findMany({
      where,
      include: {
        claimant: { select: { id: true, fullName: true, universityEmail: true } },
        foundReport: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(claims);
  } catch (error) {
    next(error);
  }
});

// GET /api/claims/:id (Student, Staff)
router.get("/:id", authenticate, allowRoles("STUDENT", "STAFF"), async (req, res, next) => {
  try {
    const claim = await prisma.claimRequest.findUnique({
      where: { id: req.params.id },
      include: {
        claimant: { select: { id: true, fullName: true, universityEmail: true } },
        foundReport: true,
        evidence: true,
        reviewedBy: { select: { id: true, fullName: true } }
      }
    });
    
    if (!claim) return res.status(404).json({ message: "Claim not found" });
    
    // Students can only see their own claims
    if (req.user.role === "STUDENT" && claim.claimantUserId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    res.json(claim);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/claims/:id/review (Staff)
router.patch("/:id/review", authenticate, allowRoles("STAFF"), async (req, res, next) => {
  try {
    const { status, reviewNote } = req.body;
    
    const claim = await prisma.claimRequest.update({
      where: { id: req.params.id },
      data: { 
        status,
        reviewNote,
        reviewedByUserId: req.user.id
      }
    });
    
    // Depending on the claim status, update the item report status
    let itemStatus = undefined;
    if (status === "APPROVED") {
      itemStatus = "RESOLVED";
    } else if (status === "REJECTED") {
      itemStatus = "OPEN";
    }
    
    if (itemStatus) {
      await prisma.itemReport.update({
        where: { id: claim.foundReportId },
        data: { status: itemStatus }
      });
    }
    
    let auditAction = "UPDATE_CLAIM";
    if (status === "APPROVED") auditAction = "APPROVE_CLAIM";
    if (status === "REJECTED") auditAction = "REJECT_CLAIM";
    if (status === "MORE_INFORMATION_REQUIRED") auditAction = "REQUEST_MORE_INFORMATION";

    await prisma.auditLog.create({
      data: {
        action: auditAction,
        entityType: "ClaimRequest",
        entityId: claim.id,
        details: { status, reviewNote },
        actorUserId: req.user.id
      }
    });
    
    res.json(claim);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
