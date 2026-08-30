require("dotenv").config();

const { getSecret } = require("./services/keyVault");
const { validateEnvironment } = require("./config/env");
const app = require("./app");

async function startServer() {
  try {
    process.env.DATABASE_URL = await getSecret("DATABASE-URL");
    process.env.JWT_SECRET = await getSecret("JWT-SECRET");
    process.env.GEMINI_API_KEY = await getSecret("GEMINI-API-KEY");
    process.env.MICROSOFT_CLIENT_SECRET = await getSecret(
      "MICROSOFT-CLIENT-SECRET"
    );

    validateEnvironment();

    const PORT = process.env.PORT;

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to load secrets from Azure Key Vault.");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
