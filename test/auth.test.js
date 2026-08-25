const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-that-is-only-used-by-automated-tests";
process.env.NODE_ENV = "development";
process.env.FRONTEND_URL = "http://localhost:5173";

let currentUser = null;
let lastCreatedUserData = null;
let lastFindFirstArgs = null;
let resetTokens = [];
let nextResetTokenId = 1;
let microsoftIdentity = null;
let microsoftIdentityError = null;
const microsoftHandoffs = new Map();

function matchesResetToken(token, where = {}) {
  if (where.id && token.id !== where.id) return false;
  if (where.userId && token.userId !== where.userId) return false;
  if (where.tokenHash && token.tokenHash !== where.tokenHash) return false;
  if (where.usedAt === null && token.usedAt !== null) return false;
  if (where.expiresAt?.gt && token.expiresAt <= where.expiresAt.gt) return false;
  return true;
}

const fakePrisma = {
  user: {
    findFirst: async (args) => {
      lastFindFirstArgs = args;
      if (args?.where?.OR) {
        if (!currentUser) return null;
        const objectId = args.where.OR.find((condition) => condition.microsoftObjectId)?.microsoftObjectId;
        const email = args.where.OR.find((condition) => condition.universityEmail)?.universityEmail?.equals;
        return currentUser.microsoftObjectId === objectId ||
          currentUser.universityEmail.toLowerCase() === email?.toLowerCase()
          ? currentUser
          : null;
      }
      const requestedEmail = args?.where?.universityEmail?.equals;
      if (requestedEmail && currentUser?.universityEmail.toLowerCase() !== requestedEmail.toLowerCase()) {
        return null;
      }
      return currentUser;
    },
    findUnique: async () => currentUser,
    create: async ({ data }) => {
      lastCreatedUserData = data;
      currentUser = {
        id: "4d004819-cadd-4929-9d09-8c52ec81007d",
        universityEmail: data.universityEmail,
        fullName: data.fullName,
        microsoftObjectId: data.microsoftObjectId || null,
        passwordHash: data.passwordHash,
        tokenVersion: 0,
        isActive: true,
        role: { name: data.role.connect.name }
      };
      return currentUser;
    },
    update: async ({ data }) => {
      if (data.passwordHash) currentUser.passwordHash = data.passwordHash;
      if (data.tokenVersion?.increment) currentUser.tokenVersion += data.tokenVersion.increment;
      if (data.microsoftObjectId) currentUser.microsoftObjectId = data.microsoftObjectId;
      return currentUser;
    }
  },
  passwordResetToken: {
    create: async ({ data }) => {
      const resetToken = {
        id: `reset-token-${nextResetTokenId++}`,
        ...data,
        usedAt: null,
        createdAt: new Date()
      };
      resetTokens.push(resetToken);
      return resetToken;
    },
    findUnique: async ({ where }) => {
      const resetToken = resetTokens.find((candidate) => candidate.tokenHash === where.tokenHash);
      return resetToken ? { ...resetToken, user: currentUser } : null;
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const resetToken of resetTokens) {
        if (matchesResetToken(resetToken, where)) {
          Object.assign(resetToken, data);
          count += 1;
        }
      }
      return { count };
    }
  },
  $transaction: async (operations) => {
    if (typeof operations === "function") return operations(fakePrisma);
    return Promise.all(operations);
  }
};

const prismaPath = require.resolve("../src/config/prisma");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: fakePrisma
};

const microsoftOidcPath = require.resolve("../src/services/microsoftOidc");
require.cache[microsoftOidcPath] = {
  id: microsoftOidcPath,
  filename: microsoftOidcPath,
  loaded: true,
  exports: {
    clearTransactionCookie: () => "microsoft_oidc_transaction=; Max-Age=0",
    completeAuthorization: async () => {
      if (microsoftIdentityError) throw microsoftIdentityError;
      return microsoftIdentity;
    },
    consumeHandoff: (code) => {
      const auth = microsoftHandoffs.get(code) || null;
      microsoftHandoffs.delete(code);
      return auth;
    },
    createAuthorizationRequest: async () => ({
      authorizationUrl: "https://login.microsoftonline.com/test/oauth2/v2.0/authorize?state=test-state",
      cookie: "microsoft_oidc_transaction=signed; HttpOnly; SameSite=Lax"
    }),
    createHandoff: (auth) => {
      const code = "single-use-test-handoff";
      microsoftHandoffs.set(code, auth);
      return code;
    },
    frontendLoginUrl: (parameters) => {
      const url = new URL("/login", process.env.FRONTEND_URL);
      Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
      return url.href;
    },
    microsoftLogoutUrl: async () => "https://login.microsoftonline.com/test/oauth2/v2.0/logout"
  }
};

const authRoutes = require("../src/routes/auth");
const { authenticate, allowRoles } = require("../src/middleware/auth");
const { createRateLimit } = require("../src/middleware/rateLimit");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.get(
  "/api/test/admin",
  authenticate,
  allowRoles("ADMIN"),
  (req, res) => res.status(200).json({ success: true })
);

async function request(path, options = {}) {
  const server = await new Promise((resolve, reject) => {
    const testServer = app.listen(0, "127.0.0.1", () => resolve(testServer));
    testServer.on("error", reject);
  });
  const address = server.address();

  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, options);
  } finally {
    server.close();
  }
}

function testUser(role = "STUDENT") {
  return {
    id: "2fb15fac-23a4-4df5-aa31-424c4a63b874",
    universityEmail: "u1234567@au.edu",
    universityId: "6612345",
    fullName: "Test User",
    microsoftObjectId: null,
    passwordHash: null,
    tokenVersion: 0,
    isActive: true,
    role: { name: role }
  };
}

async function microsoftLogin(extra = {}) {
  const callback = await request("/api/auth/microsoft/callback?code=test-code&state=test-state", {
    redirect: "manual"
  });
  const location = callback.headers.get("location");
  const handoff = location ? new URL(location).searchParams.get("microsoft_handoff") : "";
  if (!handoff) return callback;
  return request("/api/auth/microsoft/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: handoff, ...extra })
  });
}

async function register(email, extra = {}) {
  return request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      name: "Test Student",
      password: "secure-password",
      ...extra
    })
  });
}

async function requestReset(email) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  });
}

async function issueResetToken(email = "u1234567@au.edu") {
  let resetLog = "";
  const originalInfo = console.info;
  console.info = (message) => { resetLog = String(message); };
  try {
    const response = await requestReset(email);
    assert.equal(response.status, 200);
  } finally {
    console.info = originalInfo;
  }

  const token = new URL(resetLog.match(/https?:\/\/\S+/)[0]).searchParams.get("token");
  assert.ok(token);
  return token;
}

async function submitReset(token, password = "new-secure-password") {
  return request("/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password })
  });
}

test("uppercase AU student email registration is normalized", async () => {
  currentUser = null;
  lastCreatedUserData = null;

  const response = await register("U1234567@AU.EDU", { role: "ADMIN" });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.user.email, "u1234567@au.edu");
  assert.equal(body.user.role, "STUDENT");
  assert.equal(lastCreatedUserData.role.connect.name, "STUDENT");
  assert.equal(lastCreatedUserData.role.connect.name === "ADMIN", false);
  assert.equal(await bcrypt.compare("secure-password", lastCreatedUserData.passwordHash), true);
});

test("lowercase AU student email registration is accepted", async () => {
  currentUser = null;

  const response = await register("u7654321@au.edu");

  assert.equal(response.status, 201);
});

test("student registration rejects a non-AU domain", async () => {
  currentUser = null;
  const response = await register("u1234567@gmail.com");
  assert.equal(response.status, 400);
});

test("student registration rejects the wrong number of digits", async () => {
  currentUser = null;

  for (const email of ["u123456@au.edu", "u12345678@au.edu"]) {
    const response = await register(email);
    assert.equal(response.status, 400);
  }
});

test("duplicate student registration is rejected", async () => {
  currentUser = testUser();
  const response = await register(currentUser.universityEmail);
  assert.equal(response.status, 409);
});

test("forgot password stores only a hashed token for an existing account", async () => {
  currentUser = testUser();
  resetTokens = [];
  const rawToken = await issueResetToken();

  assert.equal(resetTokens.length, 1);
  assert.notEqual(resetTokens[0].tokenHash, rawToken);
  assert.equal(resetTokens[0].tokenHash.length, 64);
  assert.ok(resetTokens[0].expiresAt > new Date());
});

test("forgot password gives the same response for unknown and existing accounts", async () => {
  const genericMessage = "If an account exists for this email, password reset instructions have been sent.";
  currentUser = testUser();
  resetTokens = [];
  const originalInfo = console.info;
  console.info = () => {};
  let existingResponse;
  try {
    existingResponse = await requestReset(currentUser.universityEmail);
  } finally {
    console.info = originalInfo;
  }
  const existingBody = await existingResponse.json();

  const unknownResponse = await requestReset("missing@au.edu");
  const unknownBody = await unknownResponse.json();

  assert.equal(existingResponse.status, 200);
  assert.equal(unknownResponse.status, 200);
  assert.equal(existingBody.message, genericMessage);
  assert.equal(unknownBody.message, genericMessage);
});

test("valid reset hashes the new password and token cannot be reused", async () => {
  currentUser = testUser();
  currentUser.passwordHash = await bcrypt.hash("old-secure-password", 4);
  resetTokens = [];
  const rawToken = await issueResetToken();

  const response = await submitReset(rawToken);
  const reusedResponse = await submitReset(rawToken);

  assert.equal(response.status, 200);
  assert.equal(reusedResponse.status, 400);
  assert.notEqual(currentUser.passwordHash, "new-secure-password");
  assert.equal(await bcrypt.compare("new-secure-password", currentUser.passwordHash), true);
  assert.equal(await bcrypt.compare("old-secure-password", currentUser.passwordHash), false);
  assert.equal(currentUser.tokenVersion, 1);
});

test("invalid reset token is rejected", async () => {
  currentUser = testUser();
  resetTokens = [];
  const response = await submitReset("not-a-real-reset-token");
  assert.equal(response.status, 400);
});

test("expired reset token is rejected", async () => {
  currentUser = testUser();
  resetTokens = [];
  const rawToken = await issueResetToken();
  resetTokens[0].expiresAt = new Date(Date.now() - 1000);

  const response = await submitReset(rawToken);
  assert.equal(response.status, 400);
});

test("inactive account receives generic forgot response without a reset token", async () => {
  currentUser = testUser();
  currentUser.isActive = false;
  resetTokens = [];

  const response = await requestReset(currentUser.universityEmail);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.message, /If an account exists/);
  assert.equal(resetTokens.length, 0);
});

test("verified Microsoft identity returns the existing database role and application JWT", async () => {
  currentUser = testUser("STUDENT");
  microsoftIdentityError = null;
  microsoftIdentity = {
    email: currentUser.universityEmail,
    microsoftObjectId: "microsoft-object-student",
    name: "Verified Student"
  };

  const response = await microsoftLogin({ role: "ADMIN" });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.role, "STUDENT");
  assert.equal(body.user.email, currentUser.universityEmail);
  assert.equal(jwt.verify(body.token, process.env.JWT_SECRET).sub, currentUser.id);
});

for (const role of ["STAFF", "ADMIN"]) {
  test(`verified Microsoft identity preserves provisioned ${role} role`, async () => {
    currentUser = testUser(role);
    currentUser.universityEmail = `${role.toLowerCase()}@au.edu`;
    currentUser.microsoftObjectId = `microsoft-object-${role.toLowerCase()}`;
    microsoftIdentityError = null;
    microsoftIdentity = {
      email: currentUser.universityEmail,
      microsoftObjectId: currentUser.microsoftObjectId,
      name: `Verified ${role}`
    };

    const response = await microsoftLogin({ role: "STUDENT" });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.user.role, role);
  });
}

test("verified first-login student is created only as STUDENT", async () => {
  currentUser = null;
  lastCreatedUserData = null;
  microsoftIdentityError = null;
  microsoftIdentity = {
    email: "u7654321@au.edu",
    microsoftObjectId: "microsoft-object-new-student",
    name: "New Student"
  };

  const response = await microsoftLogin({ role: "ADMIN" });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.role, "STUDENT");
  assert.equal(lastCreatedUserData.role.connect.name, "STUDENT");
  assert.equal(lastCreatedUserData.passwordHash, undefined);
});

test("first-login AU identity is created only as STUDENT regardless of email style", async () => {
  currentUser = null;
  microsoftIdentityError = null;
  microsoftIdentity = {
    email: "staffname@au.edu",
    microsoftObjectId: "microsoft-object-new-staff",
    name: "Unknown Staff"
  };

  const response = await microsoftLogin();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.user.role, "STUDENT");
  assert.equal(lastCreatedUserData.role.connect.name, "STUDENT");
});

test("inactive Microsoft-authenticated user is rejected", async () => {
  currentUser = testUser();
  currentUser.isActive = false;
  microsoftIdentityError = null;
  microsoftIdentity = {
    email: currentUser.universityEmail,
    microsoftObjectId: "microsoft-object-inactive",
    name: "Inactive User"
  };

  const response = await microsoftLogin();
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location")).searchParams.get("microsoft_error"), "account_inactive");
});

test("unverified Microsoft identity is rejected", async () => {
  currentUser = testUser();
  microsoftIdentity = null;
  microsoftIdentityError = Object.assign(new Error("invalid identity"), {
    code: "MICROSOFT_IDENTITY_INVALID"
  });

  const response = await microsoftLogin();
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location")).searchParams.get("microsoft_error"), "authentication_failed");
  microsoftIdentityError = null;
});

test("missing or invalid database role fails closed during Microsoft login", async () => {
  currentUser = testUser();
  currentUser.role = { name: "UNKNOWN" };
  microsoftIdentityError = null;
  microsoftIdentity = {
    email: currentUser.universityEmail,
    microsoftObjectId: "microsoft-object-invalid-role",
    name: "Invalid Role User"
  };

  const response = await microsoftLogin();

  assert.equal(response.status, 302);
  assert.equal(
    new URL(response.headers.get("location")).searchParams.get("microsoft_error"),
    "authentication_failed"
  );
});

test("Microsoft login starts with a backend redirect and protected transaction cookie", async () => {
  const response = await request("/api/auth/microsoft", { redirect: "manual" });

  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^https:\/\/login\.microsoftonline\.com\//);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Lax/);
});

test("Microsoft handoff can only be exchanged once", async () => {
  currentUser = testUser("STUDENT");
  microsoftIdentityError = null;
  microsoftIdentity = {
    email: currentUser.universityEmail,
    microsoftObjectId: "microsoft-object-single-use",
    name: "Verified Student"
  };

  const first = await microsoftLogin();
  const second = await request("/api/auth/microsoft/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "single-use-test-handoff" })
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 401);
});

test("development password login endpoint is removed", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "u1234567@au.edu", password: "password" })
  });

  assert.equal(response.status, 404);
});

test("authenticated user can access /me", async () => {
  currentUser = testUser("STAFF");
  const token = jwt.sign({ sub: currentUser.id }, process.env.JWT_SECRET);

  const response = await request("/api/auth/me", {
    headers: { authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.role, "STAFF");
});

test("logout invalidates the application JWT", async () => {
  currentUser = testUser("STUDENT");
  const token = jwt.sign(
    { sub: currentUser.id, role: "STUDENT", ver: 0 },
    process.env.JWT_SECRET
  );

  const logoutResponse = await request("/api/auth/logout", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` }
  });
  const meResponse = await request("/api/auth/me", {
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(logoutResponse.status, 204);
  assert.equal(currentUser.tokenVersion, 1);
  assert.equal(meResponse.status, 401);
});

test("/me rejects an inactive account", async () => {
  currentUser = testUser();
  currentUser.isActive = false;
  const token = jwt.sign({ sub: currentUser.id, ver: 0 }, process.env.JWT_SECRET);

  const response = await request("/api/auth/me", {
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 401);
});

test("/me rejects an account with an invalid database role", async () => {
  currentUser = testUser();
  currentUser.role = { name: "UNKNOWN" };
  const token = jwt.sign({ sub: currentUser.id, ver: 0 }, process.env.JWT_SECRET);

  const response = await request("/api/auth/me", {
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 401);
});

test("password reset invalidates previously issued JWTs", async () => {
  currentUser = testUser();
  resetTokens = [];
  const oldToken = jwt.sign({ sub: currentUser.id, ver: 0 }, process.env.JWT_SECRET);
  const resetToken = await issueResetToken();
  assert.equal((await submitReset(resetToken)).status, 200);

  const response = await request("/api/auth/me", {
    headers: { authorization: `Bearer ${oldToken}` }
  });

  assert.equal(response.status, 401);
});

test("unauthenticated request cannot access /me", async () => {
  const response = await request("/api/auth/me");
  assert.equal(response.status, 401);
});

test("invalid JWT cannot access /me", async () => {
  const response = await request("/api/auth/me", {
    headers: { authorization: "Bearer not-a-valid-jwt" }
  });

  assert.equal(response.status, 401);
});

test("role middleware allows configured roles", () => {
  const middleware = allowRoles("STAFF", "ADMIN");
  let nextCalled = false;

  middleware(
    { user: { role: "STAFF" } },
    {},
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
});

test("student-only middleware accepts STUDENT", () => {
  const middleware = allowRoles("STUDENT");
  let nextCalled = false;

  middleware(
    { user: { role: "STUDENT" } },
    {},
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
});

test("role middleware rejects a student from staff routes", () => {
  const middleware = allowRoles("STAFF", "ADMIN");
  let statusCode;

  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {}
  };

  middleware({ user: { role: "STUDENT" } }, response, () => {});
  assert.equal(statusCode, 403);
});

test("admin-only middleware accepts ADMIN and rejects STAFF", () => {
  const middleware = allowRoles("ADMIN");
  let adminAllowed = false;
  let staffStatus;

  middleware(
    { user: { role: "ADMIN" } },
    {},
    () => { adminAllowed = true; }
  );

  middleware(
    { user: { role: "STAFF" } },
    {
      status(code) {
        staffStatus = code;
        return this;
      },
      json() {}
    },
    () => {}
  );

  assert.equal(adminAllowed, true);
  assert.equal(staffStatus, 403);
});

test("rate limiter rejects excessive authentication attempts", () => {
  const middleware = createRateLimit({ windowMs: 60_000, max: 2, message: "Try later" });
  const requestObject = { ip: "192.0.2.1" };
  let allowed = 0;
  let statusCode;
  const response = {
    set() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json() {}
  };

  middleware(requestObject, response, () => { allowed += 1; });
  middleware(requestObject, response, () => { allowed += 1; });
  middleware(requestObject, response, () => { allowed += 1; });

  assert.equal(allowed, 2);
  assert.equal(statusCode, 429);
});
