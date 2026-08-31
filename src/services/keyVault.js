const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

let client;
let clientVaultUrl;

async function getSecret(secretName) {
  const keyVaultName = process.env.AZURE_KEY_VAULT_NAME;
  if (!keyVaultName) {
    throw new Error("AZURE_KEY_VAULT_NAME is required to load Azure secrets");
  }

  const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;
  if (!client || clientVaultUrl !== keyVaultUrl) {
    const credential = new DefaultAzureCredential();
    client = new SecretClient(keyVaultUrl, credential);
    clientVaultUrl = keyVaultUrl;
  }
  const secret = await client.getSecret(secretName);

  if (!secret.value) {
    throw new Error(`Secret "${secretName}" has no value`);
  }

  return secret.value;
}

module.exports = {
  getSecret,
};
