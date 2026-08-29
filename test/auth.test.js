const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-that-is-only-used-by-automated-tests";
process.env.NODE_ENV = "development";
process.env.FRONTEND_URL = "http://localhost:5173";

let currentUser = null;
let lastCreatedUserData = null;
let lastFindFirstArgs = null;
let microsoftIdentity = null;
let microsoftIdentityError = null;
const microsoftHandoffs = new Map();

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
        tokenVersion: 0,
        isActive: true,
        role: { name: data.role.connect.name }
      };
      return currentUser;
    },
    update: async ({ data }) => {
      if (data.tokenVersion?.increment) currentUser.tokenVersion += data.tokenVersion.increment;
      if (data.microsoftObjectId) currentUser.microsoftObjectId = data.microsoftObjectId;
      return currentUser;
    }
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

test("password-based authentication endpoints are removed", async () => {
  for (const path of ["register", "forgot-password", "reset-password", "login"]) {
    const response = await request(`/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(response.status, 404);
  }
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
