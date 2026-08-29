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

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
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
  } else if (
    user.microsoftObjectId &&
    user.microsoftObjectId !== identity.microsoftObjectId
  ) {
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

router.get("/microsoft", loginRateLimit, async (req, res) => {
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

router.get("/microsoft/callback", loginRateLimit, async (req, res) => {
  res.setHeader("Set-Cookie", clearTransactionCookie());

  try {
    const identity = await completeAuthorization(req);
    const user = await findOrProvisionMicrosoftUser(identity);
    const handoff = createHandoff({
      token: createToken(user),
      user: safeUser(user),
      redirect: identity.redirect
    });
    return res.redirect(302, frontendLoginUrl({ microsoft_handoff: handoff }));
  } catch (error) {
    const reason = error.code === "MICROSOFT_ACCOUNT_INACTIVE"
      ? "account_inactive"
      : "authentication_failed";
    return res.redirect(302, frontendLoginUrl({ microsoft_error: reason }));
  }
});

router.post("/microsoft/exchange", loginRateLimit, (req, res) => {
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

router.post("/login", loginRateLimit, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || !password || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const user = await prisma.user.findFirst({
    where: { universityEmail: { equals: email, mode: "insensitive" } },
    include: { role: true }
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  if (!user.isActive) {
    if (user.verificationCode) {
      return res.status(403).json({ 
        success: false, 
        code: "EMAIL_NOT_VERIFIED", 
        message: "Your email is not verified yet. Please verify your email first." 
      });
    }
    return res.status(401).json({ success: false, message: "This account has been deactivated" });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
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
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const user = await prisma.user.create({
      data: {
        universityEmail: email,
        fullName: name,
        passwordHash: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS),
        role: { connect: { name: "STUDENT" } },
        isActive: false,
        verificationCode: otp,
        verificationExpiresAt: otpExpiry
      },
      include: { role: true }
    });

    console.info(`\n[Verification OTP] Verification code for student ${email}: ${otp}\n`);

    return res.status(201).json({
      success: true,
      message: "Verification code sent to your email. Please verify your email."
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

router.post("/verify-otp", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

    if (!email || !code) {
      return res.status(400).json({ success: false, message: "Email and verification code are required" });
    }

    const user = await prisma.user.findUnique({
      where: { universityEmail: email }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isActive && !user.verificationCode) {
      return res.status(200).json({ success: true, message: "Email is already verified." });
    }

    if (user.verificationCode !== code || !user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        verificationCode: null,
        verificationExpiresAt: null
      }
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now log in."
    });
  } catch (error) {
    next(error);
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
