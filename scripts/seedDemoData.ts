import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ClaimStatus,
  MatchConfidence,
  MatchStatus,
  PrismaClient,
  ReportStatus,
  ReportType,
  RoleName,
} from "../generated/prisma";

const connectionString = process.env.DATABASE_URL;
const demoUserEmail = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();

if (!connectionString) {
  throw new Error("DATABASE_URL is required to create demo data.");
}

if (!demoUserEmail) {
  throw new Error(
    "DEMO_USER_EMAIL is required. Sign in once first, then run: DEMO_USER_EMAIL=your-email@au.edu npm run seed:demo",
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function upsertReport(data: {
  title: string;
  description: string;
  reportType: ReportType;
  status: ReportStatus;
  location: string;
  occurredAt: Date;
  color: string | null;
  brand: string | null;
  createdById: string;
  categoryId: string;
}) {
  const existing = await prisma.itemReport.findFirst({
    where: { title: data.title, createdById: data.createdById },
  });

  if (existing) {
    return prisma.itemReport.update({ where: { id: existing.id }, data });
  }

  return prisma.itemReport.create({ data });
}

async function main() {
  const [studentRole, staffRole, walletCategory, keysCategory, idCategory, laptopCategory] =
    await Promise.all([
      prisma.role.findUnique({ where: { name: RoleName.STUDENT } }),
      prisma.role.findUnique({ where: { name: RoleName.STAFF } }),
      prisma.itemCategory.findUnique({ where: { name: "Wallet" } }),
      prisma.itemCategory.findUnique({ where: { name: "Keys" } }),
      prisma.itemCategory.findUnique({ where: { name: "ID Card" } }),
      prisma.itemCategory.findUnique({ where: { name: "Laptop" } }),
    ]);

  if (!studentRole || !staffRole || !walletCategory || !keysCategory || !idCategory || !laptopCategory) {
    throw new Error("Base roles/categories are missing. Run npm run prisma:seed first.");
  }

  const demoUser = await prisma.user.findFirst({
    where: { universityEmail: { equals: demoUserEmail, mode: "insensitive" } },
  });
  if (!demoUser) {
    throw new Error(
      `No database user exists for ${demoUserEmail}. Sign in with Microsoft once before seeding demo data.`,
    );
  }

  const demoFinder = await prisma.user.upsert({
    where: { universityEmail: "demo.finder@au.edu" },
    update: { fullName: "Demo Lost & Found Desk", isActive: true, roleId: staffRole.id },
    create: {
      universityEmail: "demo.finder@au.edu",
      fullName: "Demo Lost & Found Desk",
      isActive: true,
      roleId: staffRole.id,
    },
  });

  const [lostWallet, foundWallet, lostKeys, foundKeys, foundIdCard, lostLaptop] = await Promise.all([
    upsertReport({
      title: "DEMO: Lost black wallet",
      description: "Black leather wallet with a small gold zipper and AU card inside.",
      reportType: ReportType.LOST,
      status: ReportStatus.MATCHED,
      location: "AU Library, second floor",
      occurredAt: new Date("2026-08-25T10:15:00+07:00"),
      color: "Black",
      brand: "Charles & Keith",
      createdById: demoUser.id,
      categoryId: walletCategory.id,
    }),
    upsertReport({
      title: "DEMO: Found black wallet",
      description: "Black zip wallet found near the library study tables. Contains an AU card.",
      reportType: ReportType.FOUND,
      status: ReportStatus.CLAIM_IN_PROGRESS,
      location: "AU Library, second floor",
      occurredAt: new Date("2026-08-25T12:30:00+07:00"),
      color: "Black",
      brand: "Charles & Keith",
      createdById: demoFinder.id,
      categoryId: walletCategory.id,
    }),
    upsertReport({
      title: "DEMO: Lost silver keys",
      description: "Three silver keys on a blue fabric keychain.",
      reportType: ReportType.LOST,
      status: ReportStatus.OPEN,
      location: "Cathedral of Learning entrance",
      occurredAt: new Date("2026-08-27T08:40:00+07:00"),
      color: "Silver",
      brand: null,
      createdById: demoUser.id,
      categoryId: keysCategory.id,
    }),
    upsertReport({
      title: "DEMO: Found blue keychain with keys",
      description: "A blue fabric keychain holding three silver keys was handed to the desk.",
      reportType: ReportType.FOUND,
      status: ReportStatus.OPEN,
      location: "Cathedral of Learning entrance",
      occurredAt: new Date("2026-08-27T09:10:00+07:00"),
      color: "Silver",
      brand: null,
      createdById: demoFinder.id,
      categoryId: keysCategory.id,
    }),
    upsertReport({
      title: "DEMO: Found student ID card",
      description: "An AU student ID card was found beside the cafeteria checkout.",
      reportType: ReportType.FOUND,
      status: ReportStatus.OPEN,
      location: "Student cafeteria",
      occurredAt: new Date("2026-08-28T13:20:00+07:00"),
      color: "White",
      brand: null,
      createdById: demoFinder.id,
      categoryId: idCategory.id,
    }),
    upsertReport({
      title: "DEMO: Lost laptop sleeve",
      description: "Grey 13-inch laptop sleeve with a notebook in the front pocket.",
      reportType: ReportType.LOST,
      status: ReportStatus.OPEN,
      location: "Building A, room 302",
      occurredAt: new Date("2026-08-28T15:45:00+07:00"),
      color: "Grey",
      brand: null,
      createdById: demoUser.id,
      categoryId: laptopCategory.id,
    }),
  ]);

  await prisma.matchSuggestion.upsert({
    where: {
      lostReportId_foundReportId: {
        lostReportId: lostWallet.id,
        foundReportId: foundWallet.id,
      },
    },
    update: {
      totalScore: 94,
      descriptionSimilarityScore: 96,
      categoryScore: 100,
      colorScore: 100,
      locationScore: 100,
      dateScore: 100,
      confidence: MatchConfidence.HIGH,
      status: MatchStatus.SUGGESTED,
      reasons: ["Same category", "Same color", "Same reported location", "Item was found shortly after the reported loss date"],
      reviewerId: null,
      reviewedAt: null,
    },
    create: {
      lostReportId: lostWallet.id,
      foundReportId: foundWallet.id,
      totalScore: 94,
      descriptionSimilarityScore: 96,
      categoryScore: 100,
      colorScore: 100,
      locationScore: 100,
      dateScore: 100,
      confidence: MatchConfidence.HIGH,
      status: MatchStatus.SUGGESTED,
      reasons: ["Same category", "Same color", "Same reported location", "Item was found shortly after the reported loss date"],
      matchSource: "DEMO_DATA",
    },
  });

  const existingClaim = await prisma.claimRequest.findFirst({
    where: { claimantUserId: demoUser.id, foundReportId: foundWallet.id },
  });
  if (existingClaim) {
    await prisma.claimRequest.update({
      where: { id: existingClaim.id },
      data: {
        status: ClaimStatus.PENDING,
        identifyingDetails: "DEMO: The wallet contains my AU card and a gold zipper.",
        reviewNote: null,
      },
    });
  } else {
    await prisma.claimRequest.create({
      data: {
        claimantUserId: demoUser.id,
        foundReportId: foundWallet.id,
        status: ClaimStatus.PENDING,
        identifyingDetails: "DEMO: The wallet contains my AU card and a gold zipper.",
      },
    });
  }

  console.log("Created or refreshed 6 demo reports, 1 suggested match, and 1 pending claim.");
  console.log(`Demo reports owned by: ${demoUser.universityEmail}`);
  console.log("Switch your own role in Prisma Studio to test STUDENT, STAFF, and ADMIN with this same dataset.");
}

main()
  .catch((error: unknown) => {
    console.error("Demo data creation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
