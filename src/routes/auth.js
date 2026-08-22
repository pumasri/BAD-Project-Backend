const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const prisma = require("../config/prisma");
const { authenticate } = require("../middleware/auth");
const { normalizeEmail, isAuEmail, isAuStudentEmail } = require("../utils/studentEmail");
const {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  PASSWORD_HASH_ROUNDS,
  isValidPassword
} = require("../utils/password");
const { createRateLimit } = require("../middleware/rateLimit");
const { deliverPasswordReset } = require("../services/passwordResetDelivery");
const { verifyMicrosoftIdentity } = require("../services/microsoftIdentity");

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";
const genericResetMessage =
  "If an account exists for this email, password reset instructions have been sent.";
const sensitiveEndpointMessage = "Too many attempts. Please try again later.";
const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 100,
  message: sensitiveEndpointMessage
});
const resetRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 100,
  message: sensitiveEndpointMessage
});
const dummyPasswordHash = bcrypt.hashSync(
  "authentication-timing-placeholder",
  PASSWORD_HASH_ROUNDS
);

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.universityEmail,
    name: user.fullName,
    role: user.role.name
  };
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return jwt.sign(
    { sub: user.id, role: user.role.name, ver: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

function developmentOnly(req, res, next) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({
      success: false,
      message: "Not found"
    });
  }

  return next();
}

router.post("/login", developmentOnly, loginRateLimit, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!isAuEmail(email) || email.length > 254 || typeof password !== "string" || !password || password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  const user = await prisma.user.findFirst({
    where: { universityEmail: { equals: email, mode: "insensitive" } },
    include: { role: true }
  });

  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash || dummyPasswordHash
  );

  if (!user || !user.passwordHash || !passwordMatches || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
  }

  return res.status(200).json({
    token: createToken(user),
    user: safeUser(user)
  });
});

router.post("/microsoft", loginRateLimit, async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";

  if (!idToken || idToken.length > 20_000) {
    return res.status(400).json({
      success: false,
      message: "Microsoft identity token is required"
    });
  }

  let identity;
  try {
    identity = await verifyMicrosoftIdentity(idToken);
  } catch (error) {
    if (error.code === "MICROSOFT_AUTH_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        message: "Microsoft authentication is not configured"
      });
    }
    return res.status(401).json({
      success: false,
      message: "Microsoft authentication failed"
    });
  }

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
    if (!isAuStudentEmail(identity.email)) {
      return res.status(403).json({
        success: false,
        message: "This AU account has not been provisioned"
      });
    }

    user = await prisma.user.create({
      data: {
        universityEmail: identity.email,
        fullName: identity.name,
        microsoftObjectId: identity.microsoftObjectId,
        role: { connect: { name: "STUDENT" } }
      },
      include: { role: true }
    });
  } else if (
    user.microsoftObjectId &&
    user.microsoftObjectId !== identity.microsoftObjectId
  ) {
    return res.status(403).json({
      success: false,
      message: "Microsoft authentication failed"
    });
  } else if (!user.microsoftObjectId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { microsoftObjectId: identity.microsoftObjectId },
      include: { role: true }
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "This account is inactive"
    });
  }

  return res.status(200).json({
    token: createToken(user),
    user: safeUser(user)
  });
});

router.post("/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const password = req.body?.password;

  if (!email || email.length > 254 || !name || name.length > 120 || typeof password !== "string" || !password) {
    return res.status(400).json({
      success: false,
      message: "Email, name, and password are required"
    });
  }

  if (!isAuStudentEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Email must be an AU student address such as u1234567@au.edu"
    });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      message: `Password must contain ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters`
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { universityEmail: email }
  });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists"
    });
  }

  try {
    const user = await prisma.user.create({
      data: {
        universityEmail: email,
        fullName: name,
        passwordHash: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS),
        role: { connect: { name: "STUDENT" } }
      },
      include: { role: true }
    });

    return res.status(201).json({
      token: createToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    throw error;
  }
});

router.post("/forgot-password", resetRateLimit, async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isAuEmail(email) || email.length > 254) {
    return res.status(400).json({ success: false, message: "A valid AU email is required" });
  }

  const user = await prisma.user.findFirst({
    where: { universityEmail: { equals: email, mode: "insensitive" } }
  });

  if (user?.isActive) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt }
      })
    ]);

    deliverPasswordReset({ email: user.universityEmail, token });
  }

  return res.status(200).json({ message: genericResetMessage });
});

router.post("/reset-password", resetRateLimit, async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = req.body?.password;

  if (!token || token.length > 256 || !isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      message: `A valid reset token and password of ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters are required`
    });
  }

  const tokenHash = hashResetToken(token);
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  const resetSucceeded = await prisma.$transaction(async (transaction) => {
    const resetToken = await transaction.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date() || !resetToken.user.isActive) {
      return false;
    }

    const claimed = await transaction.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: { usedAt: new Date() }
    });

    if (claimed.count !== 1) {
      return false;
    }

    await transaction.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 }
      }
    });
    await transaction.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() }
    });

    return true;
  });

  if (!resetSucceeded) {
    return res.status(400).json({
      success: false,
      message: "This password reset link is invalid or has expired"
    });
  }

  return res.status(200).json({ message: "Password reset successful. You can now log in." });
});

router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({ user: req.user });
});

module.exports = router;
