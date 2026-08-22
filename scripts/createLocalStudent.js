require("dotenv/config");

const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");
const { normalizeEmail, isAuStudentEmail } = require("../src/utils/studentEmail");
const { PASSWORD_HASH_ROUNDS } = require("../src/utils/password");

async function main() {
  const universityEmail = normalizeEmail(process.env.LOCAL_USER_EMAIL);
  const fullName = process.env.LOCAL_USER_NAME?.trim();
  const password = process.env.LOCAL_USER_PASSWORD;

  if (!universityEmail || !fullName || !password) {
    throw new Error(
      "LOCAL_USER_EMAIL, LOCAL_USER_NAME, and LOCAL_USER_PASSWORD are required."
    );
  }

  if (!isAuStudentEmail(universityEmail)) {
    throw new Error("LOCAL_USER_EMAIL must match u1234567@au.edu.");
  }

  if (password.length < 12) {
    throw new Error("LOCAL_USER_PASSWORD must contain at least 12 characters.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { universityEmail }
  });

  if (existingUser) {
    throw new Error("A user with that email already exists; no changes were made.");
  }

  await prisma.user.create({
    data: {
      universityEmail,
      fullName,
      passwordHash: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS),
      role: { connect: { name: "STUDENT" } }
    }
  });

  console.log(`Created local STUDENT account for ${universityEmail}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
