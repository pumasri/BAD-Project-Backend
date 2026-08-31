const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const roleName = process.argv[3];

  if (!email || !roleName) {
    console.log("Usage: node set-role.js <email> <STUDENT|STAFF|ADMIN>");
    process.exit(1);
  }

  try {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.log(`Role ${roleName} not found in DB!`);
      process.exit(1);
    }

    const user = await prisma.user.update({
      where: { universityEmail: email },
      data: { roleId: role.id }
    });

    console.log(`Successfully updated ${user.universityEmail} to role: ${roleName}`);
  } catch (error) {
    console.error("Error updating user:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
