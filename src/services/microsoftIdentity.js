const { isAuEmail, normalizeEmail } = require("../utils/studentEmail");

function configurationError() {
  const error = new Error("Microsoft authentication is not configured");
  error.code = "MICROSOFT_AUTH_NOT_CONFIGURED";
  return error;
}

function verificationError() {
  const error = new Error("Microsoft identity token is invalid");
  error.code = "MICROSOFT_IDENTITY_INVALID";
  return error;
}

async function verifyMicrosoftIdentity(idToken) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  if (!clientId || !tenantId) {
    throw configurationError();
  }

  try {
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    );
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: clientId,
      algorithms: ["RS256"]
    });

    const email = normalizeEmail(payload.preferred_username || payload.email);
    if (
      payload.tid !== tenantId ||
      typeof payload.oid !== "string" ||
      !isAuEmail(email)
    ) {
      throw verificationError();
    }

    return {
      email,
      microsoftObjectId: payload.oid,
      name: typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim().slice(0, 120)
        : email.split("@")[0]
    };
  } catch (error) {
    if (error.code === "MICROSOFT_IDENTITY_INVALID") {
      throw error;
    }
    throw verificationError();
  }
}

module.exports = { verifyMicrosoftIdentity };
