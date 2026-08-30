const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { queueMatchingForReport, runMatchingForReport } = require("../services/matching.service");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET /api/items (Public/Student/Staff)
router.get("/", async (req, res, next) => {
  try {
    const { type, status, category } = req.query;
    const where = {};
    if (type) where.reportType = type.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (category) where.categoryId = category;
    
    const items = await prisma.itemReport.findMany({
      where,
      include: {
        category: true,
        createdBy: {
          select: { id: true, fullName: true, universityEmail: true }
        },
        images: true
      },
      orderBy: { reportedAt: 'desc' }
    });
    
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/matches", authenticate, allowRoles("STUDENT", "STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const report = await prisma.itemReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ message: "Item not found" });
    if (req.user.role === "STUDENT" && (report.reportType !== "LOST" || report.createdById !== req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const reportFilter = report.reportType === "LOST" ? { lostReportId: report.id } : { foundReportId: report.id };
    const matches = await prisma.matchSuggestion.findMany({
      where: req.user.role === "STUDENT"
        ? { ...reportFilter, status: { in: ["SUGGESTED", "CONFIRMED", "CLAIMED", "RESOLVED"] } }
        : reportFilter,
      include: {
        lostReport: { include: { category: true } },
        foundReport: { include: { category: true } }
      },
      orderBy: { totalScore: "desc" }
    });

    if (req.user.role !== "STUDENT") return res.json(matches);
    return res.json(matches.map((match) => ({
      id: match.id,
      score: match.totalScore,
      confidence: match.confidence,
      status: match.status,
      reasons: match.reasons,
      foundItem: {
        category: match.foundReport.category?.name || null,
        approximateLocation: match.foundReport.location.split(",")[0].trim(),
        approximateDate: new Date(match.foundReport.occurredAt).toISOString().slice(0, 7)
      }
    })));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/matches/run", authenticate, allowRoles("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const matches = await runMatchingForReport(req.params.id);
    return res.status(200).json({ matches });
  } catch (error) {
    if (error.code === "REPORT_NOT_FOUND") return res.status(404).json({ message: "Item not found" });
    return next(error);
  }
});

// GET /api/items/:id (Public/Student/Staff)
router.get("/:id", async (req, res, next) => {
  try {
    const item = await prisma.itemReport.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        createdBy: {
          select: { id: true, fullName: true, universityEmail: true }
        },
        images: true
      }
    });
    
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// POST /api/items (Student, Staff)
router.post("/", authenticate, allowRoles("STUDENT", "STAFF"), async (req, res, next) => {
  try {
    const { title, description, reportType, categoryId, location, occurredAt, color, brand, isPublic } = req.body;
    
    const item = await prisma.itemReport.create({
      data: {
        title,
        description,
        reportType,
        categoryId,
        location,
        occurredAt: new Date(occurredAt),
        color,
        brand,
        isPublic: isPublic !== undefined ? isPublic : true,
        createdById: req.user.id
      }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "CREATE_ITEM",
        entityType: "ItemReport",
        entityId: item.id,
        actorUserId: req.user.id
      }
    });
    
    res.status(201).json(item);
    queueMatchingForReport(item.id);
  } catch (error) {
    next(error);
  }
});

// POST /api/items/:id/images (Student, Staff)
router.post("/:id/images", authenticate, allowRoles("STUDENT", "STAFF"), upload.single("image"), async (req, res, next) => {
  try {
    const item = await prisma.itemReport.findUnique({
      where: { id: req.params.id }
    });

    if (!item) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Item not found" });
    }

    if (req.user.role === "STUDENT" && item.createdById !== req.user.id) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ message: "Forbidden: You do not own this item report." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const image = await prisma.itemImage.create({
      data: {
        objectKey: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        reportId: item.id
      }
    });

    res.status(201).json(image);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// PATCH /api/items/:id (Staff)
router.patch("/:id", authenticate, allowRoles("STAFF"), async (req, res, next) => {
  try {
    const { title, description, location, status, categoryId, color, brand, occurredAt } = req.body;
    
    const item = await prisma.itemReport.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        location,
        status,
        categoryId,
        color,
        brand,
        occurredAt: occurredAt === undefined ? undefined : new Date(occurredAt)
      }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_ITEM",
        entityType: "ItemReport",
        entityId: item.id,
        details: { title, description, location, status },
        actorUserId: req.user.id
      }
    });
    
    res.json(item);
    queueMatchingForReport(item.id);
  } catch (error) {
    next(error);
  }
});

// POST /api/items/:id/match (Staff)
router.post("/:id/match", authenticate, allowRoles("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const { foundReportId } = req.body;
    const lostReportId = req.params.id;

    const [lostReport, foundReport] = await Promise.all([
      prisma.itemReport.findUnique({ where: { id: lostReportId } }),
      prisma.itemReport.findUnique({ where: { id: foundReportId } })
    ]);
    if (!lostReport || !foundReport) return res.status(404).json({ message: "Item not found" });
    if (lostReport.reportType !== "LOST" || foundReport.reportType !== "FOUND") {
      return res.status(400).json({ message: "A match must connect one lost report and one found report" });
    }

    const match = await prisma.matchSuggestion.upsert({
      where: { lostReportId_foundReportId: { lostReportId, foundReportId } },
      create: {
        totalScore: 100,
        descriptionSimilarityScore: 100,
        categoryScore: 100,
        colorScore: 100,
        locationScore: 100,
        dateScore: 100,
        confidence: "HIGH",
        reasons: ["Manually confirmed by staff"],
        status: "CONFIRMED",
        matchSource: "MANUAL_STAFF",
        reviewerId: req.user.id,
        reviewedAt: new Date(),
        lostReportId,
        foundReportId
      },
      update: {
        status: "CONFIRMED",
        matchSource: "MANUAL_STAFF",
        reviewerId: req.user.id,
        reviewedAt: new Date()
      }
    });

    await prisma.itemReport.update({
      where: { id: lostReportId },
      data: { status: "MATCHED" }
    });

    await prisma.itemReport.update({
      where: { id: foundReportId },
      data: { status: "MATCHED" }
    });

    await prisma.auditLog.create({
      data: {
        action: "MATCH_ITEMS",
        entityType: "MatchSuggestion",
        entityId: match.id,
        actorUserId: req.user.id
      }
    });

    res.json(match);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
