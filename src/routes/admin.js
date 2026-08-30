const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { isValidPassword } = require("../utils/password");

const router = express.Router();

// GET /api/admin/users (Admin)
router.get("/users", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map to safe user object format
    res.json(users.map(u => ({
      id: u.id,
      email: u.universityEmail,
      name: u.fullName,
      role: u.role.name,
      isActive: u.isActive
    })));
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users (Admin)
router.post("/users", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { email, name, password, roleName = "STAFF" } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: "Password does not meet requirements" });
    }
    
    const existingUser = await prisma.user.findFirst({
      where: { universityEmail: { equals: email, mode: "insensitive" } }
    });
    
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        universityEmail: email,
        fullName: name,
        passwordHash: hashedPassword,
        isActive: true,
        role: { connect: { name: roleName } }
      },
      include: { role: true }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "CREATE_USER",
        entityType: "User",
        entityId: user.id,
        details: { role: user.role.name, email: user.universityEmail },
        actorUserId: req.user.id
      }
    });
    
    res.status(201).json({
      id: user.id,
      email: user.universityEmail,
      name: user.fullName,
      role: user.role.name,
      isActive: user.isActive
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/role (Admin)
router.patch("/users/:id/role", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { roleId, roleName } = req.body;
    
    let updateData = {};
    if (roleId) updateData.roleId = roleId;
    else if (roleName) updateData.role = { connect: { name: roleName } };

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      include: { role: true }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_USER_ROLE",
        entityType: "User",
        entityId: user.id,
        details: { role: user.role.name },
        actorUserId: req.user.id
      }
    });
    
    res.json({
      id: user.id,
      email: user.universityEmail,
      name: user.fullName,
      role: user.role.name
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/status (Admin)
router.patch("/users/:id/status", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    
    // Prevent admin from deactivating their own account
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own account" });
    }
    
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      include: { role: true }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_USER_STATUS",
        entityType: "User",
        entityId: user.id,
        details: { isActive: user.isActive },
        actorUserId: req.user.id
      }
    });
    
    res.json({
      id: user.id,
      email: user.universityEmail,
      name: user.fullName,
      role: user.role.name,
      isActive: user.isActive
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/categories (Admin)
router.get("/categories", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const categories = await prisma.itemCategory.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/categories/:id/status (Admin)
router.patch("/categories/:id/status", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    
    const category = await prisma.itemCategory.update({
      where: { id: req.params.id },
      data: { isActive }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CATEGORY_STATUS",
        entityType: "ItemCategory",
        entityId: category.id,
        details: { isActive: category.isActive },
        actorUserId: req.user.id
      }
    });
    
    res.json(category);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/audit-logs (Admin)
router.get("/audit-logs", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { action, userId } = req.query;
    const where = {};
    if (action) where.action = action;
    if (userId) where.actorUserId = userId;
    
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, fullName: true, universityEmail: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/partners (Admin)
router.get("/partners", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const partners = await prisma.partnerClient.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        baseUrl: true,
        apiKeyIdentifier: true,
        isActive: true,
        createdAt: true
      }
    });
    
    res.json(partners);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/partners (Admin)
router.post("/partners", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { name, description, baseUrl } = req.body;
    
    const crypto = require("node:crypto");
    // Generate an API key for the partner
    const apiKeyIdentifier = crypto.randomBytes(16).toString('hex');
    const apiKeySecret = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = crypto.createHash('sha256').update(apiKeySecret).digest('hex');
    
    const partner = await prisma.partnerClient.create({
      data: {
        name,
        description,
        baseUrl,
        apiKeyIdentifier,
        apiKeyHash
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        apiKeyIdentifier: true
      }
    });
    
    await prisma.auditLog.create({
      data: {
        action: "CREATE_PARTNER",
        entityType: "PartnerClient",
        entityId: partner.id,
        actorUserId: req.user.id
      }
    });
    
    // Only return the secret once
    res.status(201).json({
      ...partner,
      secret: apiKeySecret
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
