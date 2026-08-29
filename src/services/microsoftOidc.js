const crypto = require("node:crypto");

const { normalizeEmail, isAuEmail } = require("../utils/studentEmail");

const TRANSACTION_COOKIE = "microsoft_oidc_transaction";
const TRANSACTION_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 60 * 1000;
const handoffs = new Map();
let clientPromise;

function configurationError() {
  const error = new Error("Microsoft authentication is not configured");
  error.code = "MICROSOFT_AUTH_NOT_CONFIGURED";
  return error;
}

function authenticationError() {
  const error = new Error("Microsoft authentication failed");
  error.code = "MICROSOFT_AUTH_FAILED";
  return error;
}

function getSettings() {
  const settings = {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    tenantId: process.env.MICROSOFT_TENANT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
    frontendUrl: process.env.FRONTEND_URL
  };

  if (Object.values(settings).some((value) => !value)) {
    throw configurationError();
  }

  return settings;
}

async function getClient() {
  const settings = getSettings();
  if (!clientPromise) {
    clientPromise = import("openid-client").then((oidc) =>
      oidc.discovery(
        new URL(`https://login.microsoftonline.com/${settings.tenantId}/v2.0`),
        settings.clientId,
        settings.clientSecret
      )
    );
  }
  return { oidc: await import("openid-client"), config: await clientPromise, settings };
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  if (!process.env.JWT_SECRET) throw configurationError();
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(value).digest("base64url");
}

function encodeTransaction(transaction) {
  const payload = base64url(JSON.stringify(transaction));
  return `${payload}.${sign(payload)}`;
}

function decodeTransaction(value) {
  if (!value || typeof value !== "string" || value.length > 4096) throw authenticationError();
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) throw authenticationError();

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw authenticationError();
  }

  try {
    const transaction = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!transaction.expiresAt || transaction.expiresAt <= Date.now()) throw authenticationError();
    return transaction;
  } catch (error) {
    if (error.code === "MICROSOFT_AUTH_FAILED") throw error;
    throw authenticationError();
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}

function transactionCookie(value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${TRANSACTION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/api/auth/microsoft/callback; Max-Age=${maxAgeSeconds}${secure}`;
}

async function createAuthorizationRequest(redirect) {
  const { oidc, config, settings } = await getClient();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const authorizationUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: settings.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account"
  });
  const transaction = encodeTransaction({
    state,
    nonce,
    codeVerifier,
    redirect,
    expiresAt: Date.now() + TRANSACTION_TTL_MS
  });

  return {
    authorizationUrl: authorizationUrl.href,
    cookie: transactionCookie(transaction, TRANSACTION_TTL_MS / 1000)
  };
}

async function completeAuthorization(req) {
  const transaction = decodeTransaction(readCookie(req, TRANSACTION_COOKIE));
  const { oidc, config, settings } = await getClient();
  const callbackUrl = new URL(settings.redirectUri);
  for (const [key, value] of new URL(req.originalUrl, settings.redirectUri).searchParams) {
    callbackUrl.searchParams.append(key, value);
  }

  const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: transaction.codeVerifier,
    expectedState: transaction.state,
    expectedNonce: transaction.nonce
  });
  const claims = tokens.claims();
  const email = normalizeEmail(claims?.preferred_username || claims?.email);

  if (
    !claims ||
    claims.tid !== settings.tenantId ||
    typeof claims.oid !== "string" ||
    !claims.oid ||
    !isAuEmail(email)
  ) {
    throw authenticationError();
  }

  return {
    email,
    microsoftObjectId: claims.oid,
    name: typeof claims.name === "string" && claims.name.trim()
      ? claims.name.trim().slice(0, 120)
      : email.split("@")[0],
    redirect: transaction.redirect
  };
}

function clearTransactionCookie() {
  return transactionCookie("", 0);
}

function createHandoff(auth) {
  const now = Date.now();
  for (const [existingCode, handoff] of handoffs) {
    if (handoff.expiresAt <= now) handoffs.delete(existingCode);
  }
  const code = crypto.randomBytes(32).toString("base64url");
  handoffs.set(code, { auth, expiresAt: now + HANDOFF_TTL_MS });
  return code;
}

function consumeHandoff(code) {
  const handoff = typeof code === "string" ? handoffs.get(code) : null;
  if (typeof code === "string") handoffs.delete(code);
  if (!handoff || handoff.expiresAt <= Date.now()) return null;
  return handoff.auth;
}

function frontendLoginUrl(parameters = {}) {
  const { frontendUrl } = getSettings();
  const url = new URL("/student-login", frontendUrl);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

async function microsoftLogoutUrl() {
  const settings = getSettings();
  const url = new URL(
    `https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/logout`
  );
  url.searchParams.set("post_logout_redirect_uri", new URL("/", settings.frontendUrl).href);
  return url.href;
}

module.exports = {
  clearTransactionCookie,
  completeAuthorization,
  consumeHandoff,
  createAuthorizationRequest,
  createHandoff,
  frontendLoginUrl,
  microsoftLogoutUrl
};
