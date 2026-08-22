const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-that-is-only-used-by-automated-tests";

let currentUser = null;

const fakePrisma = {
  user: {
    findFirst: async () => currentUser,
    findUnique: async () => currentUser,
    update: async () => currentUser
  }
};

const prismaPath = require.resolve("../src/config/prisma");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: fakePrisma
};

const authRoutes = require("../src/routes/auth");
const { allowRoles } = require("../src/middleware/auth");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

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
    email: "user@au.edu",
    universityId: "6612345",
    displayName: "Test User",
    microsoftOid: null,
    passwordHash: null,
    isActive: true,
    role: { name: role }
  };
}

test("normal login returns an application JWT", async () => {
  currentUser = testUser();
  currentUser.passwordHash = await bcrypt.hash("correct-password", 4);

  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: "user@au.edu",
      password: "correct-password"
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.role, "STUDENT");
  assert.equal(jwt.verify(body.token, process.env.JWT_SECRET).sub, currentUser.id);
  assert.equal(body.user.passwordHash, undefined);
});

test("invalid password is rejected", async () => {
  currentUser = testUser();
  currentUser.passwordHash = await bcrypt.hash("correct-password", 4);

  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: "user@au.edu",
      password: "wrong-password"
    })
  });

  assert.equal(response.status, 401);
});

test("missing credentials are rejected", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: "user@au.edu" })
  });

  assert.equal(response.status, 400);
});

test("unknown user is rejected", async () => {
  currentUser = null;

  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: "missing@au.edu",
      password: "password"
    })
  });

  assert.equal(response.status, 401);
});

test("inactive user is rejected", async () => {
  currentUser = testUser();
  currentUser.passwordHash = await bcrypt.hash("correct-password", 4);
  currentUser.isActive = false;

  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: "user@au.edu",
      password: "correct-password"
    })
  });

  assert.equal(response.status, 403);
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

test("unauthenticated request cannot access /me", async () => {
  const response = await request("/api/auth/me");
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

test("Microsoft login reports missing configuration", async () => {
  delete process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_TENANT_ID;

  const response = await request("/api/auth/microsoft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: "not-a-real-token" })
  });

  assert.equal(response.status, 503);
});
