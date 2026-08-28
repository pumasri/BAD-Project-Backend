const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

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
        }
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

// PATCH /api/items/:id/status (Staff)
router.patch("/:id/status", authenticate, allowRoles("STAFF"), async (req, res, next) => {
  try {
    const { status } = req.body;
    
    const item = await prisma.itemReport.update({
      where: { id: req.params.id },
      data: { status }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_ITEM",
        entityType: "ItemReport",
        entityId: item.id,
        details: { status },
        actorUserId: req.user.id
      }
    });
    
    res.json(item);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
