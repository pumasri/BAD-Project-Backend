import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleName } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const roleNames = [
  RoleName.STUDENT,
  RoleName.STAFF,
  RoleName.ADMIN,
] as const;

const categoryNames = [
  "Wallet",
  "Phone",
  "Tablet",
  "Laptop",
  "ID Card",
  "Keys",
  "Bottle",
  "Bag",
  "Clothing",
  "Accessories",
  "Electronics",
  "Other",
] as const;

async function main() {
  await Promise.all(
    roleNames.map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  await Promise.all(
    categoryNames.map((name) =>
      prisma.itemCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  console.log("Seeded 3 roles and 12 item categories.");
}

main()
  .catch((error: unknown) => {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
