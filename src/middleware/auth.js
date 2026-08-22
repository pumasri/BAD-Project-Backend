const jwt = require("jsonwebtoken");

const prisma = require("../config/prisma");

async function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required"
    });
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET is required"));
  }

  try {
    const token = authorization.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });

    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      throw new Error("Invalid token subject");
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid or inactive account"
      });
    }

    if ((payload.ver ?? 0) !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    req.user = {
      id: user.id,
      email: user.universityEmail,
      name: user.fullName,
      role: user.role.name
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
}

function allowRoles(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource"
      });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  allowRoles
};
