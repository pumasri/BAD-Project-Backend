const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

// GET /api/categories (Any)
router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.itemCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// POST /api/categories (Admin)
router.post("/", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    const category = await prisma.itemCategory.create({
      data: {
        name,
        description
      }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "CREATE_CATEGORY",
        entityType: "ItemCategory",
        entityId: category.id,
        actorUserId: req.user.id
      }
    });
    
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
