const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
    const { title, description, location, status } = req.body;
    
    const item = await prisma.itemReport.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        location,
        status
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
  } catch (error) {
    next(error);
  }
});

// POST /api/items/:id/match (Staff)
router.post("/:id/match", authenticate, allowRoles("STAFF"), async (req, res, next) => {
  try {
    const { foundReportId } = req.body;
    const lostReportId = req.params.id;

    const match = await prisma.matchSuggestion.create({
      data: {
        confidenceScore: 1.0,
        matchSource: "MANUAL_STAFF",
        lostReportId,
        foundReportId
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
