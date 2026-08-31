const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");
const fs = require("fs");
const { imageUpload } = require("../middleware/imageUpload");

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

    if (foundItem.status !== "OPEN" && foundItem.status !== "CLAIM_IN_PROGRESS" && foundItem.status !== "MATCHED") {
      return res.status(400).json({
        message: "This item is not available for a new claim"
      });
    }

    if (foundItem.createdById === req.user.id) {
      return res.status(400).json({
        message: "You cannot claim an item that you reported."
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
    
    // Update item status to CLAIM_IN_PROGRESS if it was OPEN or MATCHED
    if (foundItem.status === "OPEN" || foundItem.status === "MATCHED") {
      await prisma.itemReport.update({
        where: { id: foundReportId },
        data: { status: "CLAIM_IN_PROGRESS" }
      });
    }
    
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

// POST /api/claims/:id/evidence (Student)
router.post("/:id/evidence", authenticate, allowRoles("STUDENT"), imageUpload.single("image"), async (req, res, next) => {
  try {
    const claim = await prisma.claimRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!claim) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Claim not found" });
    }

    if (claim.claimantUserId !== req.user.id) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const evidence = await prisma.claimEvidence.create({
      data: {
        evidenceType: "IMAGE",
        objectKey: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        claimRequestId: claim.id
      }
    });

    res.status(201).json(evidence);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// GET /api/claims/my (Student)
router.get("/my", authenticate, allowRoles("STUDENT"), async (req, res, next) => {
  try {
    const claims = await prisma.claimRequest.findMany({
      where: { claimantUserId: req.user.id },
      include: {
        foundReport: true,
        evidence: true
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
        foundReport: true,
        evidence: true
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
    
    // Depending on the claim status, update the item report status and manage other claims
    let itemStatus = undefined;
    if (status === "APPROVED") {
      itemStatus = "RESOLVED";
      
      // Auto-reject all other pending claims for this item
      await prisma.claimRequest.updateMany({
        where: {
          foundReportId: claim.foundReportId,
          id: { not: claim.id },
          status: "PENDING"
        },
        data: {
          status: "REJECTED",
          reviewNote: "This item has been claimed by another user.",
          reviewedByUserId: req.user.id
        }
      });
    } else if (status === "REJECTED") {
      // Check if there are other pending claims left
      const otherPendingClaimsCount = await prisma.claimRequest.count({
        where: {
          foundReportId: claim.foundReportId,
          id: { not: claim.id },
          status: "PENDING"
        }
      });
      
      if (otherPendingClaimsCount === 0) {
        itemStatus = "OPEN";
      } else {
        itemStatus = "CLAIM_IN_PROGRESS";
      }
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
