const express = require("express");
const jwt = require("jsonwebtoken");

const prisma = require("../config/prisma");
const { authenticate } = require("../middleware/auth");
const { createRateLimit } = require("../middleware/rateLimit");
const {
  clearTransactionCookie,
  completeAuthorization,
  consumeHandoff,
  createAuthorizationRequest,
  createHandoff,
  frontendLoginUrl,
  microsoftLogoutUrl
} = require("../services/microsoftOidc");

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";
const applicationRoles = new Set(["STUDENT", "STAFF", "ADMIN"]);
const sensitiveEndpointMessage = "Too many attempts. Please try again later.";
// Only the user-initiated start should consume the normal login-attempt budget.
// The callback and handoff exchange are separate OAuth steps; sharing one
// counter across all three steps made a single sign-in consume three attempts,
// which could block users on shared university/proxy IP addresses.
const loginStartRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 100,
  message: sensitiveEndpointMessage
});

const oauthCompletionRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 30 : 300,
  message: sensitiveEndpointMessage
});

function safeUser(user) {
  if (!applicationRoles.has(user.role?.name)) {
    const error = new Error("The account role is invalid");
    error.code = "INVALID_ACCOUNT_ROLE";
    throw error;
  }
  return {
    id: user.id,
    email: user.universityEmail,
    name: user.fullName,
    role: user.role.name
  };
}

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  if (!applicationRoles.has(user.role?.name)) {
    const error = new Error("The account role is invalid");
    error.code = "INVALID_ACCOUNT_ROLE";
    throw error;
  }
  return jwt.sign(
    { sub: user.id, role: user.role.name, ver: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

async function findOrProvisionMicrosoftUser(identity) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { microsoftObjectId: identity.microsoftObjectId },
        { universityEmail: { equals: identity.email, mode: "insensitive" } }
      ]
    },
    include: { role: true }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        universityEmail: identity.email,
        fullName: identity.name,
        microsoftObjectId: identity.microsoftObjectId,
        role: { connect: { name: "STUDENT" } }
      },
      include: { role: true }
    });
  } else if (user.microsoftObjectId && user.microsoftObjectId !== identity.microsoftObjectId) {
    const error = new Error("Microsoft authentication failed");
    error.code = "MICROSOFT_AUTH_FAILED";
    throw error;
  } else if (!user.microsoftObjectId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { microsoftObjectId: identity.microsoftObjectId },
      include: { role: true }
    });
  }

  if (!user.isActive) {
    const error = new Error("This account is inactive");
    error.code = "MICROSOFT_ACCOUNT_INACTIVE";
    throw error;
  }
  return user;
}

router.get("/microsoft", loginStartRateLimit, async (req, res) => {
  try {
    const authorization = await createAuthorizationRequest(req.query.redirect);
    res.setHeader("Set-Cookie", authorization.cookie);
    return res.redirect(302, authorization.authorizationUrl);
  } catch (error) {
    const status = error.code === "MICROSOFT_AUTH_NOT_CONFIGURED" ? 503 : 500;
    return res.status(status).json({
      success: false,
      message: status === 503
        ? "Microsoft authentication is not configured"
        : "Unable to start Microsoft authentication"
    });
  }
});

router.get("/microsoft/callback", oauthCompletionRateLimit, async (req, res) => {
  res.setHeader("Set-Cookie", clearTransactionCookie());
  let authenticationStage = "authorization";
  try {
    const identity = await completeAuthorization(req);
    authenticationStage = "user_provisioning";
    const user = await findOrProvisionMicrosoftUser(identity);
    authenticationStage = "handoff_creation";
    const handoff = createHandoff({
      token: createToken(user),
      user: safeUser(user),
      redirect: identity.redirect
    });
    return res.redirect(302, frontendLoginUrl({ microsoft_handoff: handoff }));
  } catch (error) {
    const diagnostic = {
      stage: authenticationStage,
      category: error.code || error.name || "UNKNOWN_ERROR",
      oauthError: error.error || error.cause?.error,
      cause: error.cause?.code || error.cause?.name
    };
    Object.keys(diagnostic).forEach((key) => {
      if (!diagnostic[key]) delete diagnostic[key];
    });
    console.warn("Microsoft callback failed", diagnostic);
    const reason = error.code === "MICROSOFT_ACCOUNT_INACTIVE"
      ? "account_inactive"
      : authenticationStage === "user_provisioning"
        ? "account_setup_failed"
      : "authentication_failed";
    return res.redirect(302, frontendLoginUrl({ microsoft_error: reason }));
  }
});

router.post("/microsoft/exchange", oauthCompletionRateLimit, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!code || code.length > 256) {
    return res.status(400).json({ success: false, message: "Invalid sign-in handoff" });
  }
  const auth = consumeHandoff(code);
  if (!auth) {
    return res.status(401).json({
      success: false,
      message: "This sign-in attempt has expired or was already used"
    });
  }
  return res.status(200).json(auth);
});

router.get("/microsoft/logout", async (req, res) => {
  return res.redirect(302, await microsoftLogoutUrl());
});

router.post("/logout", authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { tokenVersion: { increment: 1 } }
  });
  return res.status(204).end();
});

router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({ user: req.user });
});

router.post("/dev/switch-role", authenticate, async (req, res, next) => {
  if (isProduction) return res.status(403).json({ error: "Not allowed in production" });
  try {
    const { roleName } = req.body;
    if (!applicationRoles.has(roleName)) return res.status(400).json({ error: "Invalid role" });

    const roleRecord = await prisma.role.findUnique({ where: { name: roleName } });
    if (!roleRecord) return res.status(400).json({ error: "Role not found in DB" });

    // Keep dev personas separate. Mutating the current user made items created
    // as STAFF appear to have been reported by the STUDENT after switching
    // roles, which correctly blocked that student from claiming them.
    const devEmail = `dev-${roleName.toLowerCase()}@campus.local`;
    const devUser = await prisma.user.upsert({
      where: { universityEmail: devEmail },
      update: { roleId: roleRecord.id, isActive: true },
      create: {
        universityEmail: devEmail,
        fullName: `Development ${roleName}`,
        roleId: roleRecord.id
      },
      include: { role: true }
    });

    res.json({
      message: "Development role switched",
      token: createToken(devUser),
      user: safeUser(devUser)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
