require("dotenv/config");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../../generated/prisma");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

try {
  const databaseUrl = new URL(connectionString);

  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("Unsupported database protocol");
  }
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
