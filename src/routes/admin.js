const express = require("express");
const prisma = require("../config/prisma");
const { authenticate, allowRoles } = require("../middleware/auth");

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

// PATCH /api/admin/users/:id/role (Admin)
router.patch("/users/:id/role", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { roleId } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { roleId },
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
