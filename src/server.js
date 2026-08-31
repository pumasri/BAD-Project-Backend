require("dotenv").config();

const { getSecret } = require("./services/keyVault");
const { validateEnvironment } = require("./config/env");

const secretNames = {
  DATABASE_URL: "DATABASE-URL",
  JWT_SECRET: "JWT-SECRET",
  GEMINI_API_KEY: "GEMINI-API-KEY",
  MICROSOFT_CLIENT_SECRET: "MICROSOFT-CLIENT-SECRET"
};

async function startServer() {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !process.env.AZURE_KEY_VAULT_NAME) {
      throw new Error("Azure Key Vault is required in production");
    }

    if (process.env.AZURE_KEY_VAULT_NAME) {
      const entries = Object.entries(secretNames);
      const missingLocalValues = entries.filter(([environmentName]) => !process.env[environmentName]);

      try {
        const vaultValues = await Promise.all(
          entries.map(([, vaultName]) => getSecret(vaultName))
        );
        console.log("Connected to Azure Key Vault.");

        entries.forEach(([environmentName], index) => {
          if (isProduction || !process.env[environmentName]) {
            process.env[environmentName] = vaultValues[index];
          }
        });
      } catch (error) {
        if (isProduction || missingLocalValues.length > 0) {
          throw error;
        }
      }
    }

    if (!isProduction) console.log("Development settings loaded.");

    validateEnvironment();

    const app = require("./app");
    const PORT = process.env.PORT;

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server.");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
