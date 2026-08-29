const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.OPENAI_EMBEDDING_MODEL = "test-model";

const {
  buildMatchingText,
  createEmbeddingFingerprint,
  validateEmbedding
} = require("../src/services/embedding.services");

let reports = new Map();
let matches = new Map();
let embeddingCalls = 0;
let embeddingFailure = false;

const fakePrisma = {
  itemReport: {
    findUnique: async ({ where }) => reports.get(where.id) || null,
    findMany: async ({ where }) => [...reports.values()].filter((report) =>
      report.reportType === where.reportType && where.status.in.includes(report.status)
    ),
    update: async ({ where, data }) => {
      const report = reports.get(where.id);
      Object.assign(report, data);
      return report;
    }
  },
  matchSuggestion: {
    findUnique: async ({ where }) => {
      const pair = where.lostReportId_foundReportId;
      return matches.get(`${pair.lostReportId}:${pair.foundReportId}`) || null;
    },
    create: async ({ data }) => {
      const match = { id: `match-${matches.size + 1}`, status: "SUGGESTED", ...data };
      matches.set(`${data.lostReportId}:${data.foundReportId}`, match);
      return match;
    },
    update: async ({ where, data }) => {
      const pair = where.lostReportId_foundReportId;
      const match = matches.get(`${pair.lostReportId}:${pair.foundReportId}`);
      Object.assign(match, data);
      return match;
    }
  }
};

const prismaPath = require.resolve("../src/config/prisma");
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const embeddingPath = require.resolve("../src/services/embedding.services");
const realEmbedding = require(embeddingPath);
require.cache[embeddingPath] = {
  id: embeddingPath,
  filename: embeddingPath,
  loaded: true,
  exports: {
    ...realEmbedding,
    generateEmbedding: async (report, { model }) => {
      embeddingCalls += 1;
      if (embeddingFailure) {
        const error = new Error("unavailable");
        error.code = "EMBEDDING_PROVIDER_ERROR";
        throw error;
      }
      return {
        vector: report.vector || [1, 0],
        model,
        fingerprint: realEmbedding.createEmbeddingFingerprint(report, model)
      };
    }
  }
};

const matching = require("../src/services/matching.service");

function report(overrides = {}) {
  return {
    id: "lost-1",
    title: "Black leather wallet",
    description: "Wallet with a metal zipper",
    reportType: "LOST",
    status: "OPEN",
    location: "AU Library, second floor",
    occurredAt: new Date("2026-08-20T10:00:00Z"),
    color: "Black",
    brand: null,
    categoryId: "wallet",
    category: { id: "wallet", name: "Wallet" },
    embedding: null,
    embeddingModel: null,
    embeddingFingerprint: null,
    embeddingStatus: "PENDING",
    ...overrides
  };
}

test.beforeEach(() => {
  reports = new Map();
  matches = new Map();
  embeddingCalls = 0;
  embeddingFailure = false;
});

test("embedding text uses matching fields and excludes identity", () => {
  const text = buildMatchingText(report({
    createdBy: { universityEmail: "secret@au.edu" },
    identifyingDetails: "hidden serial"
  }));
  assert.match(text, /category: wallet/);
  assert.match(text, /title: black leather wallet/);
  assert.match(text, /color: black/);
  assert.doesNotMatch(text, /secret@au\.edu|hidden serial/);
});

test("embedding helpers handle missing fields and invalid vectors", () => {
  assert.equal(buildMatchingText(report({ color: null, brand: undefined })).includes("brand:"), false);
  assert.equal(createEmbeddingFingerprint(report()).length, 64);
  assert.throws(() => validateEmbedding([]), /invalid response/);
});

test("cosine similarity handles identical and dissimilar vectors", () => {
  assert.equal(matching.cosineSimilarity([1, 2], [1, 2]), 1);
  assert.equal(matching.cosineSimilarity([1, 0], [0, 1]), 0);
});

test("deterministic scoring applies weights and HIGH confidence", () => {
  const lost = report();
  const found = report({
    id: "found-1",
    reportType: "FOUND",
    occurredAt: new Date("2026-08-21T10:00:00Z")
  });
  const score = matching.calculateMatchScore(lost, found, 1);
  assert.equal(score.totalScore, 100);
  assert.equal(score.confidence, "HIGH");
  assert.equal(score.categoryScore, 100);
});

test("POSSIBLE and below-threshold scores are classified by configured threshold", () => {
  const lost = report({ color: null, location: "Library" });
  const found = report({
    id: "found-1",
    reportType: "FOUND",
    color: null,
    location: "Cafeteria",
    occurredAt: new Date("2026-09-10T10:00:00Z")
  });
  const possible = matching.calculateMatchScore(lost, found, 1);
  assert.equal(possible.totalScore, 60);
  assert.equal(possible.confidence, "POSSIBLE");
  const below = matching.calculateMatchScore(lost, found, 0);
  assert.ok(below.totalScore < 60);
});

test("same-type and different-category comparisons are rejected", () => {
  const lost = report();
  assert.equal(matching.calculateMatchScore(lost, report({ id: "lost-2" }), 1), null);
  assert.equal(matching.calculateMatchScore(
    lost,
    report({ id: "found", reportType: "FOUND", categoryId: "keys" }),
    1
  ), null);
});

test("color, location, and date rules normalize safely", () => {
  assert.equal(matching.colorSimilarity(" Grey ", "silver"), 0.75);
  assert.equal(matching.colorSimilarity("red", "green"), 0);
  assert.equal(matching.locationSimilarity("AU Library 2nd Floor", "library 2nd floor"), 0.8);
  assert.equal(matching.dateSimilarity("2026-08-20", "2026-08-21"), 1);
  assert.equal(matching.dateSimilarity("2026-08-21", "2026-08-20"), null);
  assert.equal(matching.dateSimilarity("invalid", "2026-08-20"), null);
});

test("eligibility excludes resolved and unavailable reports", () => {
  assert.equal(matching.isEligibleReport(report()), true);
  for (const status of ["RESOLVED", "DONATED", "DISPOSED", "ARCHIVED"]) {
    assert.equal(matching.isEligibleReport(report({ status })), false);
  }
});

test("lost-to-found matching saves once and prevents duplicates", async () => {
  const lost = report({ vector: [1, 0] });
  const found = report({
    id: "found-1",
    reportType: "FOUND",
    occurredAt: new Date("2026-08-21T10:00:00Z"),
    vector: [1, 0]
  });
  reports.set(lost.id, lost);
  reports.set(found.id, found);

  assert.equal((await matching.runMatchingForReport(lost.id)).length, 1);
  assert.equal((await matching.runMatchingForReport(lost.id)).length, 1);
  assert.equal(matches.size, 1);
});

test("stored embeddings are reused and changed matching content regenerates", async () => {
  const value = report();
  reports.set(value.id, value);
  await matching.ensureEmbedding(value);
  assert.equal(embeddingCalls, 1);
  await matching.ensureEmbedding(value);
  assert.equal(embeddingCalls, 1);
  value.title = "Changed wallet";
  await matching.ensureEmbedding(value);
  assert.equal(embeddingCalls, 2);
});

test("provider failure is recorded without leaking provider details", async () => {
  const value = report();
  reports.set(value.id, value);
  embeddingFailure = true;
  await assert.rejects(matching.ensureEmbedding(value), { code: "EMBEDDING_PROVIDER_ERROR" });
  assert.equal(value.embeddingStatus, "FAILED");
  assert.equal(value.embeddingError, "EMBEDDING_PROVIDER_ERROR");
});

test("queued matching isolates OpenAI failure from report creation", async () => {
  const value = report();
  reports.set(value.id, value);
  embeddingFailure = true;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(matching.queueMatchingForReport(value.id), undefined);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(reports.has(value.id), true);
  assert.equal(value.embeddingStatus, "FAILED");
});
