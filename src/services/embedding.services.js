const crypto = require("node:crypto");

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-embedding-001";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const MAX_EMBEDDING_DIMENSIONS = 10000;

function getEmbeddingProvider() {
  return (process.env.EMBEDDING_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
}

function getEmbeddingModel() {
  return (process.env.EMBEDDING_MODEL || DEFAULT_MODEL).trim();
}

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

function createEmbeddingFingerprint(report, model = getEmbeddingModel()) {
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

function getProviderConfiguration() {
  const provider = getEmbeddingProvider();
  if (provider !== "gemini") {
    const error = new Error("Embedding provider is not supported");
    error.code = "EMBEDDING_PROVIDER_UNSUPPORTED";
    throw error;
  }
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("Embedding service is not configured");
    error.code = "EMBEDDING_NOT_CONFIGURED";
    throw error;
  }

  return {
    provider,
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: process.env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL
  };
}

function createClient() {
  const configuration = getProviderConfiguration();
  const moduleValue = require("openai");
  const OpenAI = moduleValue.default || moduleValue;
  return new OpenAI({
    apiKey: configuration.apiKey,
    baseURL: configuration.baseURL,
    timeout: 10000,
    maxRetries: 1
  });
}

function safeEmbeddingErrorCode(error) {
  if (error?.code?.startsWith?.("EMBEDDING_")) return error.code;
  if (error?.status === 429) return "EMBEDDING_RATE_LIMITED";
  if (error?.status === 401 || error?.status === 403) return "EMBEDDING_AUTH_FAILED";
  if (
    error?.code === "ETIMEDOUT" ||
    error?.code === "ECONNABORTED" ||
    String(error?.name || "").toLowerCase().includes("timeout")
  ) {
    return "EMBEDDING_TIMEOUT";
  }
  if (error?.status >= 500) return "EMBEDDING_PROVIDER_UNAVAILABLE";
  return "EMBEDDING_PROVIDER_ERROR";
}

async function generateEmbedding(report, options = {}) {
  const model = options.model || getEmbeddingModel();
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
    safeError.code = safeEmbeddingErrorCode(error);
    throw safeError;
  }
}

module.exports = {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  buildMatchingText,
  createEmbeddingFingerprint,
  generateEmbedding,
  getEmbeddingModel,
  getEmbeddingProvider,
  normalizeText,
  safeEmbeddingErrorCode,
  validateEmbedding
};
