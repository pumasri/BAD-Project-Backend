const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const keyVaultName = process.env.AZURE_KEY_VAULT_NAME;

if (!keyVaultName) {
  throw new Error("AZURE_KEY_VAULT_NAME is required");
}

const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;

const credential = new DefaultAzureCredential();
const client = new SecretClient(keyVaultUrl, credential);

async function getSecret(secretName) {
  const secret = await client.getSecret(secretName);

  if (!secret.value) {
    throw new Error(`Secret "${secretName}" has no value`);
  }

  return secret.value;
}

module.exports = {
  getSecret,
};
