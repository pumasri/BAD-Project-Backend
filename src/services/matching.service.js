const prisma = require("../config/prisma");
const {
  ELIGIBLE_REPORT_STATUSES,
  MATCH_THRESHOLDS,
  MATCH_WEIGHTS
} = require("../config/matching");
const {
  createEmbeddingFingerprint,
  generateEmbedding,
  normalizeText,
  validateEmbedding
} = require("./embedding.services");

const COLOR_GROUPS = [
  new Set(["gray", "grey", "silver"]),
  new Set(["blue", "navy", "navy blue"]),
  new Set(["red", "maroon", "burgundy"]),
  new Set(["white", "cream", "ivory"]),
  new Set(["black", "charcoal"])
];

function cosineSimilarity(left, right) {
  validateEmbedding(left);
  validateEmbedding(right);
  if (left.length !== right.length) return 0;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(leftMagnitude * rightMagnitude)));
}

function categorySimilarity(lost, found) {
  return lost?.categoryId && lost.categoryId === found?.categoryId ? 1 : 0;
}

function colorSimilarity(left, right) {
  const first = normalizeText(left);
  const second = normalizeText(right);
  if (!first || !second) return 0;
  if (first === second) return 1;
  return COLOR_GROUPS.some((group) => group.has(first) && group.has(second)) ? 0.75 : 0;
}

function locationSimilarity(left, right) {
  const first = normalizeText(left);
  const second = normalizeText(right);
  if (!first || !second) return 0;
  if (first === second) return 1;
  if (first.includes(second) || second.includes(first)) return 0.8;

  const firstTokens = new Set(first.split(/[^a-z0-9]+/).filter((token) => token.length > 1));
  const secondTokens = new Set(second.split(/[^a-z0-9]+/).filter((token) => token.length > 1));
  const common = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const union = new Set([...firstTokens, ...secondTokens]).size;
  const overlap = union ? common / union : 0;
  return overlap >= 0.5 ? 0.7 : overlap > 0 ? 0.4 : 0;
}

function dateSimilarity(lostDate, foundDate) {
  const lost = new Date(lostDate);
  const found = new Date(foundDate);
  if (!Number.isFinite(lost.getTime()) || !Number.isFinite(found.getTime())) return null;

  const days = (found.getTime() - lost.getTime()) / 86400000;
  if (days < 0) return null;
  if (days <= 1) return 1;
  if (days <= 3) return 0.8;
  if (days <= 7) return 0.6;
  if (days <= 14) return 0.3;
  return 0;
}

function calculateMatchScore(lost, found, descriptionSimilarity) {
  if (lost?.reportType !== "LOST" || found?.reportType !== "FOUND") return null;

  const category = categorySimilarity(lost, found);
  if (!category) return null;

  const date = dateSimilarity(lost.occurredAt, found.occurredAt);
  if (date === null) return null;

  const description = Math.max(0, Math.min(1, descriptionSimilarity));
  const color = colorSimilarity(lost.color, found.color);
  const location = locationSimilarity(lost.location, found.location);
  const totalScore = 100 * (
    description * MATCH_WEIGHTS.description +
    category * MATCH_WEIGHTS.category +
    color * MATCH_WEIGHTS.color +
    location * MATCH_WEIGHTS.location +
    date * MATCH_WEIGHTS.date
  );

  const reasons = ["Same category"];
  if (description >= 0.7) reasons.push("Descriptions are semantically similar");
  if (color === 1) reasons.push("Same color");
  else if (color > 0) reasons.push("Similar color");
  if (location === 1) reasons.push("Same reported location");
  else if (location > 0) reasons.push("Same or nearby reported location");
  if (date >= 0.6) reasons.push("Item was found shortly after the reported loss date");

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    descriptionSimilarityScore: Math.round(description * 10000) / 100,
    categoryScore: category * 100,
    colorScore: color * 100,
    locationScore: location * 100,
    dateScore: date * 100,
    confidence: totalScore >= MATCH_THRESHOLDS.high ? "HIGH" : "POSSIBLE",
    reasons
  };
}

function isEligibleReport(report) {
  return Boolean(
    report &&
    ["LOST", "FOUND"].includes(report.reportType) &&
    ELIGIBLE_REPORT_STATUSES.includes(report.status)
  );
}

async function recordEmbeddingFailure(reportId, error) {
  try {
    await prisma.itemReport.update({
      where: { id: reportId },
      data: {
        embeddingStatus: "FAILED",
        embeddingError: error?.code || "EMBEDDING_FAILED"
      }
    });
  } catch {
    // The report creation/update remains successful even if metadata persistence fails.
  }
}

async function ensureEmbedding(report) {
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const fingerprint = createEmbeddingFingerprint(report, model);
  if (
    report.embeddingStatus === "READY" &&
    report.embeddingModel === model &&
    report.embeddingFingerprint === fingerprint
  ) {
    return validateEmbedding(report.embedding);
  }

  try {
    const result = await generateEmbedding(report, { model });
    await prisma.itemReport.update({
      where: { id: report.id },
      data: {
        embedding: result.vector,
        embeddingModel: result.model,
        embeddingFingerprint: result.fingerprint,
        embeddingUpdatedAt: new Date(),
        embeddingStatus: "READY",
        embeddingError: null
      }
    });
    return result.vector;
  } catch (error) {
    await recordEmbeddingFailure(report.id, error);
    throw error;
  }
}

async function saveSuggestedMatch(lost, found, scores) {
  const where = {
    lostReportId_foundReportId: {
      lostReportId: lost.id,
      foundReportId: found.id
    }
  };
  const data = {
    ...scores,
    lostReportId: lost.id,
    foundReportId: found.id,
    matchSource: "AI_ASSISTED"
  };
  const existing = await prisma.matchSuggestion.findUnique({ where });
  if (!existing) return prisma.matchSuggestion.create({ data });
  if (existing.status !== "SUGGESTED") return existing;
  return prisma.matchSuggestion.update({ where, data: scores });
}

async function runMatchingForReport(reportId) {
  const source = await prisma.itemReport.findUnique({
    where: { id: reportId },
    include: { category: true }
  });
  if (!source) {
    const error = new Error("Item report not found");
    error.code = "REPORT_NOT_FOUND";
    throw error;
  }
  if (!isEligibleReport(source)) return [];

  const sourceEmbedding = await ensureEmbedding(source);
  const candidates = await prisma.itemReport.findMany({
    where: {
      reportType: source.reportType === "LOST" ? "FOUND" : "LOST",
      status: { in: ELIGIBLE_REPORT_STATUSES }
    },
    include: { category: true }
  });

  const matches = [];
  for (const candidate of candidates) {
    let candidateEmbedding;
    try {
      candidateEmbedding = await ensureEmbedding(candidate);
    } catch {
      continue;
    }

    const lost = source.reportType === "LOST" ? source : candidate;
    const found = source.reportType === "FOUND" ? source : candidate;
    const scores = calculateMatchScore(
      lost,
      found,
      cosineSimilarity(
        source.reportType === "LOST" ? sourceEmbedding : candidateEmbedding,
        source.reportType === "FOUND" ? sourceEmbedding : candidateEmbedding
      )
    );
    if (!scores || scores.totalScore < MATCH_THRESHOLDS.minimum) continue;
    matches.push(await saveSuggestedMatch(lost, found, scores));
  }
  return matches;
}

function queueMatchingForReport(reportId) {
  setImmediate(() => {
    runMatchingForReport(reportId).catch((error) => {
      console.warn("AI-assisted matching skipped", {
        reportId,
        code: error?.code || "MATCHING_FAILED"
      });
    });
  });
}

module.exports = {
  calculateMatchScore,
  categorySimilarity,
  colorSimilarity,
  cosineSimilarity,
  dateSimilarity,
  ensureEmbedding,
  isEligibleReport,
  locationSimilarity,
  queueMatchingForReport,
  runMatchingForReport
};

