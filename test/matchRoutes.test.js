const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
let queuedReports = [];
let reports;
let matchRecords;

function baseReport(overrides = {}) {
  return {
    id: "lost-1",
    title: "Black wallet",
    description: "Private detailed description",
    reportType: "LOST",
    status: "OPEN",
    location: "AU Library, second floor",
    occurredAt: new Date("2026-08-20T10:00:00Z"),
    reportedAt: new Date(),
    color: "Black",
    brand: null,
    isPublic: true,
    createdById: ownerId,
    categoryId: "wallet",
    category: { id: "wallet", name: "Wallet" },
    images: [],
    ...overrides
  };
}

const fakePrisma = {
  itemReport: {
    findUnique: async ({ where }) => reports.get(where.id) || null,
    create: async ({ data }) => {
      const value = baseReport({ id: "created-report", ...data });
      reports.set(value.id, value);
      return value;
    },
    update: async ({ where, data }) => Object.assign(reports.get(where.id), data),
    findMany: async () => [...reports.values()]
  },
  matchSuggestion: {
    findMany: async ({ where }) => matchRecords.filter((match) =>
      (!where.lostReportId || match.lostReportId === where.lostReportId) &&
      (!where.foundReportId || match.foundReportId === where.foundReportId) &&
      (!where.status || (where.status.in ? where.status.in.includes(match.status) : match.status === where.status)) &&
      (!where.confidence || match.confidence === where.confidence)
    ),
    findUnique: async ({ where }) => matchRecords.find((match) => match.id === where.id) || null,
    update: async ({ where, data }) => {
      const match = matchRecords.find((candidate) => candidate.id === where.id);
      Object.assign(match, data);
      return match;
    },
    upsert: async () => matchRecords[0]
  },
  auditLog: { create: async () => ({}) }
};

const prismaPath = require.resolve("../src/config/prisma");
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const authPath = require.resolve("../src/middleware/auth");
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    authenticate: (req, res, next) => {
      const role = req.headers["x-test-role"];
      if (!role) return res.status(401).json({ message: "Authentication is required" });
      req.user = { id: req.headers["x-test-user"] || ownerId, role };
      return next();
    },
    allowRoles: (...roles) => (req, res, next) =>
      roles.includes(req.user.role) ? next() : res.status(403).json({ message: "Forbidden" })
  }
};

const matchingPath = require.resolve("../src/services/matching.service");
require.cache[matchingPath] = {
  id: matchingPath,
  filename: matchingPath,
  loaded: true,
  exports: {
    queueMatchingForReport: (id) => queuedReports.push(id),
    runMatchingForReport: async (id) => [{ id: `generated-for-${id}` }]
  }
};

const itemsRoutes = require("../src/routes/items");
const matchesRoutes = require("../src/routes/matches");
const app = express();
app.use(express.json());
app.use("/api/items", itemsRoutes);
app.use("/api/matches", matchesRoutes);

async function request(path, options = {}) {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });
  try {
    const { port } = server.address();
    return await fetch(`http://127.0.0.1:${port}${path}`, options);
  } finally {
    server.close();
  }
}

function headers(role, user = ownerId) {
  return role ? { "x-test-role": role, "x-test-user": user } : {};
}

test.beforeEach(() => {
  queuedReports = [];
  const lost = baseReport();
  const found = baseReport({
    id: "found-1",
    title: "Found wallet",
    reportType: "FOUND",
    createdById: otherId,
    occurredAt: new Date("2026-08-21T10:00:00Z")
  });
  reports = new Map([[lost.id, lost], [found.id, found]]);
  matchRecords = [{
    id: "match-1",
    lostReportId: lost.id,
    foundReportId: found.id,
    lostReport: lost,
    foundReport: found,
    totalScore: 88,
    confidence: "HIGH",
    reasons: ["Same category"],
    status: "SUGGESTED",
    reviewedAt: null,
    reviewerId: null
  }];
});

test("report creation succeeds and queues failure-isolated matching", async () => {
  const response = await request("/api/items", {
    method: "POST",
    headers: { ...headers("STUDENT"), "content-type": "application/json" },
    body: JSON.stringify({
      title: "Keys",
      description: "Lost keys",
      reportType: "LOST",
      categoryId: "keys",
      location: "Library",
      occurredAt: "2026-08-20T10:00:00Z"
    })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(queuedReports, ["created-report"]);
});

test("students can create only lost reports and staff can create only found reports", async () => {
  const payload = {
    title: "Role test item",
    description: "Role test description",
    categoryId: "keys",
    location: "Library",
    occurredAt: "2026-08-20T10:00:00Z"
  };

  const studentFoundResponse = await request("/api/items", {
    method: "POST",
    headers: { ...headers("STUDENT"), "content-type": "application/json" },
    body: JSON.stringify({ ...payload, reportType: "FOUND" })
  });
  assert.equal(studentFoundResponse.status, 403);

  const staffLostResponse = await request("/api/items", {
    method: "POST",
    headers: { ...headers("STAFF"), "content-type": "application/json" },
    body: JSON.stringify({ ...payload, reportType: "LOST" })
  });
  assert.equal(staffLostResponse.status, 403);

  const staffFoundResponse = await request("/api/items", {
    method: "POST",
    headers: { ...headers("STAFF"), "content-type": "application/json" },
    body: JSON.stringify({ ...payload, reportType: "FOUND" })
  });
  assert.equal(staffFoundResponse.status, 201);
  assert.deepEqual(queuedReports, ["created-report"]);
});

test("student sees only safe matches for their own lost report", async () => {
  const response = await request("/api/items/lost-1/matches", { headers: headers("STUDENT") });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body[0].foundItem.category, "Wallet");
  assert.equal(body[0].foundItem.approximateLocation, "AU Library");
  assert.equal(JSON.stringify(body).includes("Private detailed description"), false);
  assert.equal(JSON.stringify(body).includes("createdById"), false);
});

test("student cannot view another student's report matches", async () => {
  const response = await request("/api/items/lost-1/matches", {
    headers: headers("STUDENT", otherId)
  });
  assert.equal(response.status, 403);
});

test("match endpoints return 401 without authentication", async () => {
  assert.equal((await request("/api/items/lost-1/matches")).status, 401);
  assert.equal((await request("/api/matches")).status, 401);
});

test("student cannot run or review matches", async () => {
  assert.equal((await request("/api/items/lost-1/matches/run", {
    method: "POST",
    headers: headers("STUDENT")
  })).status, 403);
  assert.equal((await request("/api/matches/match-1", {
    method: "PATCH",
    headers: { ...headers("STUDENT"), "content-type": "application/json" },
    body: JSON.stringify({ status: "CONFIRMED" })
  })).status, 403);
});

for (const role of ["STAFF", "ADMIN"]) {
  test(`${role} can run, list, and view match details`, async () => {
    assert.equal((await request("/api/items/lost-1/matches/run", {
      method: "POST",
      headers: headers(role)
    })).status, 200);
    assert.equal((await request("/api/matches", { headers: headers(role) })).status, 200);
    assert.equal((await request("/api/matches/match-1", { headers: headers(role) })).status, 200);
  });
}

test("staff can confirm a suggestion and reviewer metadata is recorded", async () => {
  const response = await request("/api/matches/match-1", {
    method: "PATCH",
    headers: { ...headers("STAFF"), "content-type": "application/json" },
    body: JSON.stringify({ status: "CONFIRMED" })
  });
  assert.equal(response.status, 200);
  assert.equal(matchRecords[0].status, "CONFIRMED");
  assert.equal(matchRecords[0].reviewerId, ownerId);
  assert.ok(matchRecords[0].reviewedAt instanceof Date);
});

test("admin can reject a suggestion and invalid transitions are blocked", async () => {
  const first = await request("/api/matches/match-1", {
    method: "PATCH",
    headers: { ...headers("ADMIN"), "content-type": "application/json" },
    body: JSON.stringify({ status: "REJECTED" })
  });
  const second = await request("/api/matches/match-1", {
    method: "PATCH",
    headers: { ...headers("ADMIN"), "content-type": "application/json" },
    body: JSON.stringify({ status: "CONFIRMED" })
  });
  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
});
