const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../config/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    role: user.role.name
  };
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return jwt.sign(
    { sub: user.id, role: user.role.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

router.post("/login", async (req, res) => {
  const identifier = req.body.identifier?.trim();
  const password = req.body.password;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: "Login identifier and password are required"
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { universityId: identifier }
      ]
    },
    include: { role: true }
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({
      success: false,
      message: "Invalid login identifier or password"
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "This account is inactive"
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: "Invalid login identifier or password"
    });
  }

  return res.status(200).json({
    token: createToken(user),
    user: safeUser(user)
  });
});

router.post("/microsoft", async (req, res) => {
  const idToken = req.body.idToken;
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: "Microsoft ID token is required"
    });
  }

  if (!tenantId || !clientId) {
    return res.status(503).json({
      success: false,
      message: "Microsoft authentication is not configured"
    });
  }

  try {
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    );
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: clientId
    });

    const microsoftOid = payload.oid;
    const email = payload.preferred_username || payload.email;

    if (typeof microsoftOid !== "string" || typeof email !== "string") {
      return res.status(401).json({
        success: false,
        message: "Microsoft account information is incomplete"
      });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { microsoftOid },
          { email: { equals: email, mode: "insensitive" } }
        ]
      },
      include: { role: true }
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "This Microsoft account is not registered"
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive"
      });
    }

    if (user.microsoftOid && user.microsoftOid !== microsoftOid) {
      return res.status(403).json({
        success: false,
        message: "This account is linked to a different Microsoft identity"
      });
    }

    if (!user.microsoftOid) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { microsoftOid },
        include: { role: true }
      });
    }

    return res.status(200).json({
      token: createToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    console.error("Microsoft token validation failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid Microsoft token"
    });
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.status(200).json({ user: req.user });
});

module.exports = router;
