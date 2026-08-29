const crypto = require("node:crypto");

const DEFAULT_MODEL = "text-embedding-3-small";
const MAX_EMBEDDING_DIMENSIONS = 10000;

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLowerCase()
    : "";
}

function buildMatchingText(report) {
  const fields = [
    ["category", report?.category?.name],
    ["title", report?.title],
    ["color", report?.color],
    ["brand", report?.brand],
    ["description", report?.description]
  ];

  return fields
    .map(([label, value]) => [label, normalizeText(value)])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function createEmbeddingFingerprint(report, model = process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL) {
  return crypto
    .createHash("sha256")
    .update(`${model}\n${buildMatchingText(report)}`)
    .digest("hex");
}

function validateEmbedding(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_EMBEDDING_DIMENSIONS ||
    value.some((number) => typeof number !== "number" || !Number.isFinite(number))
  ) {
    const error = new Error("Embedding provider returned an invalid response");
    error.code = "EMBEDDING_INVALID_RESPONSE";
    throw error;
  }
  return value;
}

function createClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("Embedding service is not configured");
    error.code = "EMBEDDING_NOT_CONFIGURED";
    throw error;
  }

  const moduleValue = require("openai");
  const OpenAI = moduleValue.default || moduleValue;
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 10000,
    maxRetries: 1
  });
}

async function generateEmbedding(report, options = {}) {
  const model = options.model || process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL;
  const input = buildMatchingText(report);
  if (!input) {
    const error = new Error("Report has no content suitable for matching");
    error.code = "EMBEDDING_EMPTY_INPUT";
    throw error;
  }

  try {
    const client = options.client || createClient();
    const response = await client.embeddings.create({ model, input });
    return {
      vector: validateEmbedding(response?.data?.[0]?.embedding),
      model,
      fingerprint: createEmbeddingFingerprint(report, model)
    };
  } catch (error) {
    if (error?.code?.startsWith?.("EMBEDDING_")) throw error;
    const safeError = new Error("Embedding generation failed");
    safeError.code =
      error?.name === "APIConnectionTimeoutError"
        ? "EMBEDDING_TIMEOUT"
        : error?.status === 429
          ? "EMBEDDING_RATE_LIMITED"
          : "EMBEDDING_PROVIDER_ERROR";
    throw safeError;
  }
}

module.exports = {
  DEFAULT_MODEL,
  buildMatchingText,
  createEmbeddingFingerprint,
  generateEmbedding,
  normalizeText,
  validateEmbedding
};

