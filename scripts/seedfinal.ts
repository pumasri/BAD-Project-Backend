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

if (!connectionString) {
  throw new Error("DATABASE_URL is required to create seeded item data.");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Cannot run the final item seed in production environment.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Final Item Report Dataset
 *
 * Purpose:
 * - Creates a complete Lost & Found showcase dataset.
 * - Does NOT create users.
 * - Does NOT modify users or authentication data.
 * - Creates realistic matches, claims, claim evidence, and peer inventory.
 * - Reuses three explicitly configured accounts already in the database.
 *
 * The dataset contains 24 reports:
 * - 12 LOST items
 * - 12 FOUND items
 * - 12 existing item categories
 * - Strong, possible, weak, and non-match scenarios
 * - Different lifecycle statuses
 *
 * Run with:
 *   npm run seed:final
 */

const DEMO_IDS = {
  reports: {
    lostWallet: "20000000-0000-4000-8000-000000000001",
    foundWallet: "20000000-0000-4000-8000-000000000002",

    lostPhone: "20000000-0000-4000-8000-000000000003",
    foundPhone: "20000000-0000-4000-8000-000000000004",

    lostTablet: "20000000-0000-4000-8000-000000000005",
    foundTablet: "20000000-0000-4000-8000-000000000006",

    lostLaptop: "20000000-0000-4000-8000-000000000007",
    foundLaptop: "20000000-0000-4000-8000-000000000008",

    lostIdCard: "20000000-0000-4000-8000-000000000009",
    foundIdCard: "20000000-0000-4000-8000-000000000010",

    lostKeys: "20000000-0000-4000-8000-000000000011",
    foundKeys: "20000000-0000-4000-8000-000000000012",

    lostBottle: "20000000-0000-4000-8000-000000000013",
    foundBottle: "20000000-0000-4000-8000-000000000014",

    lostBag: "20000000-0000-4000-8000-000000000015",
    foundBag: "20000000-0000-4000-8000-000000000016",

    lostClothing: "20000000-0000-4000-8000-000000000017",
    foundClothing: "20000000-0000-4000-8000-000000000018",

    lostAccessories: "20000000-0000-4000-8000-000000000019",
    foundAccessories: "20000000-0000-4000-8000-000000000020",

    lostElectronics: "20000000-0000-4000-8000-000000000021",
    foundElectronics: "20000000-0000-4000-8000-000000000022",

    lostOther: "20000000-0000-4000-8000-000000000023",
    foundOther: "20000000-0000-4000-8000-000000000024",
  },
  matches: {
    wallet: "30000000-0000-4000-8000-000000000001",
    keys: "30000000-0000-4000-8000-000000000002",
    tablet: "30000000-0000-4000-8000-000000000003",
    laptop: "30000000-0000-4000-8000-000000000004",
    phone: "30000000-0000-4000-8000-000000000005",
    accessories: "30000000-0000-4000-8000-000000000006",
  },
  claims: {
    wallet: "40000000-0000-4000-8000-000000000001",
    laptop: "40000000-0000-4000-8000-000000000002",
    phone: "40000000-0000-4000-8000-000000000003",
    bag: "40000000-0000-4000-8000-000000000004",
  },
  evidence: {
    wallet: "50000000-0000-4000-8000-000000000001",
    laptop: "50000000-0000-4000-8000-000000000002",
    phone: "50000000-0000-4000-8000-000000000003",
    bag: "50000000-0000-4000-8000-000000000004",
  },
  peerItems: {
    paracetamol: "70000000-0000-4000-8000-000000000001",
    bandages: "70000000-0000-4000-8000-000000000002",
    antiseptic: "70000000-0000-4000-8000-000000000003",
    oralRehydration: "70000000-0000-4000-8000-000000000004",
  },
  syncEvent: "80000000-0000-4000-8000-000000000001",
} as const;

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

const reportAccounts = {
  admin: "u663003@au.edu", // Phanthira Kositjaroenkul
  student: "u6620025@au.edu", // Chanyanut Pumasri
  staff: "u6612119@au.edu", // Aung Hlaing Htwe
} as const;

const medicineBoxPartnerName =
  process.env.MEDICINE_BOX_PARTNER_NAME?.trim() || "ABAC Medicine Box";

type CategoryName = (typeof categoryNames)[number];

type ReportSeed = {
  id: string;
  categoryName: CategoryName;
  createdByRole: "STUDENT" | "STAFF";
  title: string;
  description: string;
  reportType: ReportType;
  status: ReportStatus;
  location: string;
  occurredAt: string;
  reportedAt: string;
  color: string | null;
  brand: string | null;
};

const reports: ReportSeed[] = [
  // ============================================================
  // TEST CASE 01 — STRONG MATCH
  // Same category + color + brand + location + close time
  // ============================================================
  {
    id: DEMO_IDS.reports.lostWallet,
    categoryName: "Wallet",
    createdByRole: "STUDENT",
    title: "Black zip wallet with gold clasp",
    description:
      "Slim black zip wallet with a small gold clasp and a transit-card sleeve. Lost after an afternoon study session.",
    reportType: ReportType.LOST,
    status: ReportStatus.MATCHED,
    location: "Assumption University Library, 3rd floor silent study area",
    occurredAt: "2026-09-10T15:20:00+07:00",
    reportedAt: "2026-09-10T16:05:00+07:00",
    color: "Black",
    brand: "Charles & Keith",
  },
  {
    id: DEMO_IDS.reports.foundWallet,
    categoryName: "Wallet",
    createdByRole: "STAFF",
    title: "Black zip wallet handed in at library desk",
    description:
      "Slim black zip wallet with a gold clasp and transit-card sleeve found after the third-floor study area was cleared.",
    reportType: ReportType.FOUND,
    status: ReportStatus.CLAIM_IN_PROGRESS,
    location: "Assumption University Library, 3rd floor service counter",
    occurredAt: "2026-09-10T15:45:00+07:00",
    reportedAt: "2026-09-10T16:15:00+07:00",
    color: "Black",
    brand: "Charles & Keith",
  },

  // ============================================================
  // TEST CASE 02 — POSSIBLE MATCH
  // Same category + brand + nearby location, different color
  // ============================================================
  {
    id: DEMO_IDS.reports.lostPhone,
    categoryName: "Phone",
    createdByRole: "STUDENT",
    title: "Blue Samsung phone with clear case",
    description:
      "Blue Samsung phone in a clear case with a small pressed-flower insert. May have been left beside a charging socket.",
    reportType: ReportType.LOST,
    status: ReportStatus.OPEN,
    location: "VMES Building, 10th floor collaboration lounge",
    occurredAt: "2026-09-10T11:35:00+07:00",
    reportedAt: "2026-09-10T12:10:00+07:00",
    color: "Blue",
    brand: "Samsung",
  },
  {
    id: DEMO_IDS.reports.foundPhone,
    categoryName: "Phone",
    createdByRole: "STAFF",
    title: "Black Samsung phone near VMES elevators",
    description:
      "Black Samsung phone found beside the elevator seating on the tenth floor. No case was attached when it was received.",
    reportType: ReportType.FOUND,
    status: ReportStatus.OPEN,
    location: "VMES Building, 10th floor elevator lobby",
    occurredAt: "2026-09-10T12:00:00+07:00",
    reportedAt: "2026-09-10T12:25:00+07:00",
    color: "Black",
    brand: "Samsung",
  },

  // ============================================================
  // TEST CASE 03 — STRONG MATCH
  // Same category + color + brand + exact room
  // ============================================================
  {
    id: DEMO_IDS.reports.lostTablet,
    categoryName: "Tablet",
    createdByRole: "STUDENT",
    title: "Silver iPad with dark blue folio cover",
    description:
      "Eleven-inch silver tablet in a dark blue folio cover, used for lecture notes in the afternoon class.",
    reportType: ReportType.LOST,
    status: ReportStatus.MATCHED,
    location: "VMES Building, 8th floor Room 810",
    occurredAt: "2026-09-11T14:40:00+07:00",
    reportedAt: "2026-09-11T15:05:00+07:00",
    color: "Silver",
    brand: "Apple",
  },
  {
    id: DEMO_IDS.reports.foundTablet,
    categoryName: "Tablet",
    createdByRole: "STAFF",
    title: "Silver tablet in navy folio cover",
    description:
      "Silver eleven-inch Apple tablet in a navy folio cover found under a seat after the Room 810 lecture ended.",
    reportType: ReportType.FOUND,
    status: ReportStatus.MATCHED,
    location: "VMES Building, 8th floor Room 810",
    occurredAt: "2026-09-11T14:55:00+07:00",
    reportedAt: "2026-09-11T15:20:00+07:00",
    color: "Silver",
    brand: "Apple",
  },

  // ============================================================
  // TEST CASE 04 — STRONG MATCH / RESOLVED
  // Same category + color + brand + exact location
  // ============================================================
  {
    id: DEMO_IDS.reports.lostLaptop,
    categoryName: "Laptop",
    createdByRole: "STUDENT",
    title: "Grey MacBook in charcoal felt sleeve",
    description:
      "Grey 13-inch laptop inside a charcoal felt sleeve with a stitched front document pocket.",
    reportType: ReportType.LOST,
    status: ReportStatus.RESOLVED,
    location: "Student Dormitory A, shared study room",
    occurredAt: "2026-09-08T20:10:00+07:00",
    reportedAt: "2026-09-08T20:35:00+07:00",
    color: "Grey",
    brand: "Apple",
  },
  {
    id: DEMO_IDS.reports.foundLaptop,
    categoryName: "Laptop",
    createdByRole: "STAFF",
    title: "Grey laptop in charcoal felt sleeve",
    description:
      "Grey 13-inch Apple laptop in a charcoal felt sleeve collected from the Dormitory A study-room attendant.",
    reportType: ReportType.FOUND,
    status: ReportStatus.RESOLVED,
    location: "Student Dormitory A, shared study room",
    occurredAt: "2026-09-08T20:30:00+07:00",
    reportedAt: "2026-09-08T20:50:00+07:00",
    color: "Grey",
    brand: "Apple",
  },

  // ============================================================
  // TEST CASE 05 — STRONG MATCH
  // Same category + color + location + close time
  // ============================================================
  {
    id: DEMO_IDS.reports.lostIdCard,
    categoryName: "ID Card",
    createdByRole: "STUDENT",
    title: "University ID card in clear holder",
    description:
      "University ID card in a clear horizontal holder attached to a black lanyard.",
    reportType: ReportType.LOST,
    status: ReportStatus.MATCHED,
    location: "Food Court, north entrance",
    occurredAt: "2026-09-09T12:15:00+07:00",
    reportedAt: "2026-09-09T12:35:00+07:00",
    color: "White",
    brand: null,
  },
  {
    id: DEMO_IDS.reports.foundIdCard,
    categoryName: "ID Card",
    createdByRole: "STAFF",
    title: "University ID card on black lanyard",
    description:
      "University ID card in a clear holder found near the north entrance.",
    reportType: ReportType.FOUND,
    status: ReportStatus.RESOLVED,
    location: "Food Court, north entrance",
    occurredAt: "2026-09-09T12:25:00+07:00",
    reportedAt: "2026-09-09T12:40:00+07:00",
    color: "White",
    brand: null,
  },

  // ============================================================
  // TEST CASE 06 — STRONG MATCH
  // Same category + identifying description + exact location
  // ============================================================
  {
    id: DEMO_IDS.reports.lostKeys,
    categoryName: "Keys",
    createdByRole: "STUDENT",
    title: "Three silver keys on blue woven keychain",
    description:
      "Three silver keys on a blue woven keychain with a small round metal tag.",
    reportType: ReportType.LOST,
    status: ReportStatus.OPEN,
    location: "Campus Shuttle stop beside Dormitory B",
    occurredAt: "2026-09-12T08:05:00+07:00",
    reportedAt: "2026-09-12T08:30:00+07:00",
    color: "Silver",
    brand: null,
  },
  {
    id: DEMO_IDS.reports.foundKeys,
    categoryName: "Keys",
    createdByRole: "STAFF",
    title: "Blue woven keychain with three silver keys",
    description:
      "Blue woven keychain holding three silver keys and a small round metal tag, received from the campus shuttle driver.",
    reportType: ReportType.FOUND,
    status: ReportStatus.OPEN,
    location: "Campus Shuttle stop beside Dormitory B",
    occurredAt: "2026-09-12T08:20:00+07:00",
    reportedAt: "2026-09-12T08:45:00+07:00",
    color: "Silver",
    brand: null,
  },

  // ============================================================
  // TEST CASE 07 — POSSIBLE / PARTIAL MATCH
  // Same category + color, but different brand and location
  // ============================================================
  {
    id: DEMO_IDS.reports.lostBottle,
    categoryName: "Bottle",
    createdByRole: "STUDENT",
    title: "Green insulated water bottle",
    description:
      "Green insulated water bottle with a black carry loop, used during evening basketball practice.",
    reportType: ReportType.LOST,
    status: ReportStatus.ARCHIVED,
    location: "Sports Complex, indoor court seating",
    occurredAt: "2026-08-20T19:10:00+07:00",
    reportedAt: "2026-08-20T19:40:00+07:00",
    color: "Green",
    brand: "Hydro Flask",
  },
  {
    id: DEMO_IDS.reports.foundBottle,
    categoryName: "Bottle",
    createdByRole: "STAFF",
    title: "Green insulated bottle",
    description:
      "Green insulated bottle with a black carry loop found near the outdoor sports entrance.",
    reportType: ReportType.FOUND,
    status: ReportStatus.DONATED,
    location: "Sports Complex, outdoor entrance",
    occurredAt: "2026-08-21T17:25:00+07:00",
    reportedAt: "2026-08-21T17:50:00+07:00",
    color: "Green",
    brand: "Thermos",
  },

  // ============================================================
  // TEST CASE 08 — STRONG MATCH
  // Same category + color + identifying contents + nearby location
  // ============================================================
  {
    id: DEMO_IDS.reports.lostBag,
    categoryName: "Bag",
    createdByRole: "STUDENT",
    title: "Beige canvas tote with navy pouch",
    description:
      "Beige canvas tote containing a navy book pouch and reusable cutlery case.",
    reportType: ReportType.LOST,
    status: ReportStatus.MATCHED,
    location: "Walkway between Dormitory A and Library",
    occurredAt: "2026-09-10T09:05:00+07:00",
    reportedAt: "2026-09-10T09:35:00+07:00",
    color: "Beige",
    brand: null,
  },
  {
    id: DEMO_IDS.reports.foundBag,
    categoryName: "Bag",
    createdByRole: "STAFF",
    title: "Beige canvas tote with navy book pouch",
    description:
      "Beige canvas tote with a navy pouch and reusable cutlery case submitted to the security post.",
    reportType: ReportType.FOUND,
    status: ReportStatus.CLAIM_IN_PROGRESS,
    location: "Walkway between Dormitory A and Library",
    occurredAt: "2026-09-10T09:20:00+07:00",
    reportedAt: "2026-09-10T09:45:00+07:00",
    color: "Beige",
    brand: null,
  },

  // ============================================================
  // TEST CASE 09 — WEAK / NON-MATCH
  // Same category + location, but different color and description
  // ============================================================
  {
    id: DEMO_IDS.reports.lostClothing,
    categoryName: "Clothing",
    createdByRole: "STUDENT",
    title: "Cream campus cardigan",
    description:
      "Cream knit cardigan with two front pockets, left on a chair after a group presentation.",
    reportType: ReportType.LOST,
    status: ReportStatus.ARCHIVED,
    location: "VMES Building, 6th floor Room 604",
    occurredAt: "2026-08-18T16:15:00+07:00",
    reportedAt: "2026-08-18T17:00:00+07:00",
    color: "Cream",
    brand: "Uniqlo",
  },
  {
    id: DEMO_IDS.reports.foundClothing,
    categoryName: "Clothing",
    createdByRole: "STAFF",
    title: "Black sports jacket",
    description:
      "Black zip-up sports jacket found on the back of a classroom chair.",
    reportType: ReportType.FOUND,
    status: ReportStatus.DISPOSED,
    location: "VMES Building, 6th floor Room 604",
    occurredAt: "2026-08-19T10:00:00+07:00",
    reportedAt: "2026-08-19T10:20:00+07:00",
    color: "Black",
    brand: "Nike",
  },

  // ============================================================
  // TEST CASE 10 — POSSIBLE MATCH
  // Same category + location, but different color
  // ============================================================
  {
    id: DEMO_IDS.reports.lostAccessories,
    categoryName: "Accessories",
    createdByRole: "STUDENT",
    title: "Rose-gold wireless earbud case",
    description:
      "Rose-gold wireless-earbud charging case without the earbuds, possibly left near the library café.",
    reportType: ReportType.LOST,
    status: ReportStatus.OPEN,
    location: "Assumption University Library, ground-floor café tables",
    occurredAt: "2026-09-11T10:45:00+07:00",
    reportedAt: "2026-09-11T11:15:00+07:00",
    color: "Rose gold",
    brand: "Samsung",
  },
  {
    id: DEMO_IDS.reports.foundAccessories,
    categoryName: "Accessories",
    createdByRole: "STAFF",
    title: "Silver wireless earbud case",
    description:
      "Silver wireless-earbud charging case found under a café table.",
    reportType: ReportType.FOUND,
    status: ReportStatus.OPEN,
    location: "Assumption University Library, ground-floor café tables",
    occurredAt: "2026-09-11T11:00:00+07:00",
    reportedAt: "2026-09-11T11:25:00+07:00",
    color: "Silver",
    brand: "Samsung",
  },

  // ============================================================
  // TEST CASE 11 — WEAK MATCH
  // Same category + similar object type, but different attributes
  // ============================================================
  {
    id: DEMO_IDS.reports.lostElectronics,
    categoryName: "Electronics",
    createdByRole: "STUDENT",
    title: "White USB-C power adapter",
    description:
      "White 65W USB-C power adapter with a short black cable, left near a wall outlet.",
    reportType: ReportType.LOST,
    status: ReportStatus.OPEN,
    location: "VMES Building, 10th floor individual study booths",
    occurredAt: "2026-09-12T13:25:00+07:00",
    reportedAt: "2026-09-12T13:55:00+07:00",
    color: "White",
    brand: "Anker",
  },
  {
    id: DEMO_IDS.reports.foundElectronics,
    categoryName: "Electronics",
    createdByRole: "STAFF",
    title: "Black USB-C charging cable",
    description:
      "Black USB-C charging cable found near the tenth-floor study booths.",
    reportType: ReportType.FOUND,
    status: ReportStatus.OPEN,
    location: "VMES Building, 10th floor individual study booths",
    occurredAt: "2026-09-12T13:45:00+07:00",
    reportedAt: "2026-09-12T14:05:00+07:00",
    color: "Black",
    brand: "Anker",
  },

  // ============================================================
  // TEST CASE 12 — NON-MATCH / OTHER
  // Similar location and date, unrelated item
  // ============================================================
  {
    id: DEMO_IDS.reports.lostOther,
    categoryName: "Other",
    createdByRole: "STUDENT",
    title: "Grey folding umbrella with wooden handle",
    description:
      "Compact grey umbrella with a curved wooden handle, left at the campus transit waiting area during rain.",
    reportType: ReportType.LOST,
    status: ReportStatus.OPEN,
    location: "Campus shuttle waiting area",
    occurredAt: "2026-09-12T17:40:00+07:00",
    reportedAt: "2026-09-12T18:10:00+07:00",
    color: "Grey",
    brand: null,
  },
  {
    id: DEMO_IDS.reports.foundOther,
    categoryName: "Other",
    createdByRole: "STAFF",
    title: "Black reusable lunch container",
    description:
      "Black reusable lunch container found on a bench at the transit waiting area.",
    reportType: ReportType.FOUND,
    status: ReportStatus.OPEN,
    location: "Campus shuttle waiting area",
    occurredAt: "2026-09-12T17:55:00+07:00",
    reportedAt: "2026-09-12T18:20:00+07:00",
    color: "Black",
    brand: null,
  },
];

async function main() {
  // ------------------------------------------------------------
  // 1. Reuse existing authenticated users.
  // ------------------------------------------------------------
  const [adminUser, studentUser, staffUser] = await Promise.all([
    prisma.user.findUnique({
      where: { universityEmail: reportAccounts.admin },
      select: { id: true, isActive: true, role: { select: { name: true } } },
    }),
    prisma.user.findUnique({
      where: { universityEmail: reportAccounts.student },
      select: { id: true, isActive: true, role: { select: { name: true } } },
    }),
    prisma.user.findUnique({
      where: { universityEmail: reportAccounts.staff },
      select: { id: true, isActive: true, role: { select: { name: true } } },
    }),
  ]);

  if (!adminUser || !adminUser.isActive || adminUser.role.name !== RoleName.ADMIN) {
    throw new Error(
      `The configured admin account ${reportAccounts.admin} is missing, inactive, or does not have the ADMIN role.`
    );
  }

  if (!studentUser || !studentUser.isActive || studentUser.role.name !== RoleName.STUDENT) {
    throw new Error(
      `The configured student account ${reportAccounts.student} is missing, inactive, or does not have the STUDENT role.`
    );
  }

  if (!staffUser || !staffUser.isActive || staffUser.role.name !== RoleName.STAFF) {
    throw new Error(
      `The configured staff account ${reportAccounts.staff} is missing, inactive, or does not have the STAFF role.`
    );
  }

  // ------------------------------------------------------------
  // 2. Load the existing item categories.
  // ------------------------------------------------------------
  const categories = await prisma.itemCategory.findMany({
    where: {
      name: {
        in: [...categoryNames],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const categoryIdByName = new Map(
    categories.map((category) => [category.name, category.id])
  );

  const missingCategories = categoryNames.filter(
    (name) => !categoryIdByName.has(name)
  );

  if (missingCategories.length > 0) {
    throw new Error(
      `Required categories are missing: ${missingCategories.join(
        ", "
      )}. Run npm run prisma:seed first.`
    );
  }

  // ------------------------------------------------------------
  // 3. Upsert ONLY item reports.
  //
  // Existing users are reused.
  // No user/authentication records are created or modified.
  // ------------------------------------------------------------
  for (const report of reports) {
    const categoryId = categoryIdByName.get(report.categoryName);

    if (!categoryId) {
      throw new Error(
        `Category lookup failed for ${report.categoryName}.`
      );
    }

    const createdById =
      report.createdByRole === "STUDENT"
        ? studentUser.id
        : staffUser.id;

    const data = {
      title: report.title,
      description: report.description,
      reportType: report.reportType,
      status: report.status,
      location: report.location,
      occurredAt: new Date(report.occurredAt),
      reportedAt: new Date(report.reportedAt),
      color: report.color,
      brand: report.brand,
      isPublic: true,
      createdById,
      categoryId,
    };

    await prisma.itemReport.upsert({
      where: { id: report.id },
      update: data,
      create: {
        id: report.id,
        ...data,
      },
    });
  }

  // ------------------------------------------------------------
  // 4. Seed representative matching lifecycle records.
  // Scores follow the configured 35/25/15/15/10 weighting.
  // ------------------------------------------------------------
  const matches = [
    {
      id: DEMO_IDS.matches.wallet,
      lostReportId: DEMO_IDS.reports.lostWallet,
      foundReportId: DEMO_IDS.reports.foundWallet,
      totalScore: 93.4,
      descriptionSimilarityScore: 94,
      categoryScore: 100,
      colorScore: 100,
      locationScore: 70,
      dateScore: 100,
      confidence: MatchConfidence.HIGH,
      reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same or nearby reported location", "Item was found shortly after the reported loss date"],
      status: MatchStatus.CLAIMED,
      matchSource: "AI_ASSISTED",
      reviewerId: adminUser.id,
      reviewedAt: new Date("2026-09-10T16:30:00+07:00"),
    },
    {
      id: DEMO_IDS.matches.keys,
      lostReportId: DEMO_IDS.reports.lostKeys,
      foundReportId: DEMO_IDS.reports.foundKeys,
      totalScore: 96.85,
      descriptionSimilarityScore: 91,
      categoryScore: 100,
      colorScore: 100,
      locationScore: 100,
      dateScore: 100,
      confidence: MatchConfidence.HIGH,
      reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same reported location", "Item was found shortly after the reported loss date"],
      status: MatchStatus.SUGGESTED,
      matchSource: "AI_ASSISTED",
      reviewerId: null,
      reviewedAt: null,
    },
    {
      id: DEMO_IDS.matches.tablet,
      lostReportId: DEMO_IDS.reports.lostTablet,
      foundReportId: DEMO_IDS.reports.foundTablet,
      totalScore: 97.2,
      descriptionSimilarityScore: 92,
      categoryScore: 100,
      colorScore: 100,
      locationScore: 100,
      dateScore: 100,
      confidence: MatchConfidence.HIGH,
      reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same reported location", "Item was found shortly after the reported loss date"],
      status: MatchStatus.CONFIRMED,
      matchSource: "AI_ASSISTED",
      reviewerId: adminUser.id,
      reviewedAt: new Date("2026-09-11T15:35:00+07:00"),
    },
    {
      id: DEMO_IDS.matches.laptop,
      lostReportId: DEMO_IDS.reports.lostLaptop,
      foundReportId: DEMO_IDS.reports.foundLaptop,
      totalScore: 98.95,
      descriptionSimilarityScore: 97,
      categoryScore: 100,
      colorScore: 100,
      locationScore: 100,
      dateScore: 100,
      confidence: MatchConfidence.HIGH,
      reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same reported location", "Item was found shortly after the reported loss date"],
      status: MatchStatus.RESOLVED,
      matchSource: "AI_ASSISTED",
      reviewerId: adminUser.id,
      reviewedAt: new Date("2026-09-09T10:20:00+07:00"),
    },
    {
      id: DEMO_IDS.matches.phone,
      lostReportId: DEMO_IDS.reports.lostPhone,
      foundReportId: DEMO_IDS.reports.foundPhone,
      totalScore: 64.75,
      descriptionSimilarityScore: 55,
      categoryScore: 100,
      colorScore: 0,
      locationScore: 70,
      dateScore: 100,
      confidence: MatchConfidence.POSSIBLE,
      reasons: ["Same category", "Same or nearby reported location", "Item was found shortly after the reported loss date"],
      status: MatchStatus.REJECTED,
      matchSource: "AI_ASSISTED",
      reviewerId: adminUser.id,
      reviewedAt: new Date("2026-09-10T13:10:00+07:00"),
    },
    {
      id: DEMO_IDS.matches.accessories,
      lostReportId: DEMO_IDS.reports.lostAccessories,
      foundReportId: DEMO_IDS.reports.foundAccessories,
      totalScore: 71.7,
      descriptionSimilarityScore: 62,
      categoryScore: 100,
      colorScore: 0,
      locationScore: 100,
      dateScore: 100,
      confidence: MatchConfidence.POSSIBLE,
      reasons: ["Same category", "Same reported location", "Item was found shortly after the reported loss date"],
      status: MatchStatus.SUGGESTED,
      matchSource: "AI_ASSISTED",
      reviewerId: null,
      reviewedAt: null,
    },
  ];

  for (const match of matches) {
    await prisma.matchSuggestion.upsert({
      where: {
        lostReportId_foundReportId: {
          lostReportId: match.lostReportId,
          foundReportId: match.foundReportId,
        },
      },
      update: match,
      create: match,
    });
  }

  // ------------------------------------------------------------
  // 5. Seed each ownership-claim state and text-only evidence.
  // ------------------------------------------------------------
  const claims = [
    { id: DEMO_IDS.claims.wallet, claimantUserId: studentUser.id, foundReportId: DEMO_IDS.reports.foundWallet, reviewedByUserId: null, status: ClaimStatus.PENDING, identifyingDetails: "The wallet has a small gold clasp, an internal transit-card sleeve, and a folded café receipt in the centre pocket.", reviewNote: null },
    { id: DEMO_IDS.claims.laptop, claimantUserId: studentUser.id, foundReportId: DEMO_IDS.reports.foundLaptop, reviewedByUserId: staffUser.id, status: ClaimStatus.APPROVED, identifyingDetails: "The felt sleeve has a stitched front pocket containing a handwritten class timetable and a compact charger pouch.", reviewNote: "The private details matched the item. Staff released it after identity verification." },
    { id: DEMO_IDS.claims.phone, claimantUserId: studentUser.id, foundReportId: DEMO_IDS.reports.foundPhone, reviewedByUserId: staffUser.id, status: ClaimStatus.REJECTED, identifyingDetails: "I was studying on the tenth floor and thought this phone might be mine.", reviewNote: "The reported colour, case, and identifying details did not match the found phone." },
    { id: DEMO_IDS.claims.bag, claimantUserId: studentUser.id, foundReportId: DEMO_IDS.reports.foundBag, reviewedByUserId: staffUser.id, status: ClaimStatus.MORE_INFORMATION_REQUIRED, identifyingDetails: "The tote should contain a navy book pouch and a reusable cutlery case.", reviewNote: "Please provide the pouch pattern and one additional non-public item from inside the bag." },
  ];

  for (const claim of claims) {
    await prisma.claimRequest.upsert({ where: { id: claim.id }, update: claim, create: claim });
  }

  const evidence = [
    { id: DEMO_IDS.evidence.wallet, claimRequestId: DEMO_IDS.claims.wallet, evidenceType: "TEXT", textValue: "Claimant described the clasp and internal transit-card sleeve.", objectKey: null, mimeType: null, fileSize: null },
    { id: DEMO_IDS.evidence.laptop, claimRequestId: DEMO_IDS.claims.laptop, evidenceType: "TEXT", textValue: "Claimant accurately described the sleeve pocket and its non-public contents.", objectKey: null, mimeType: null, fileSize: null },
    { id: DEMO_IDS.evidence.phone, claimRequestId: DEMO_IDS.claims.phone, evidenceType: "TEXT", textValue: "Claimant details were inconsistent with the item held by staff.", objectKey: null, mimeType: null, fileSize: null },
    { id: DEMO_IDS.evidence.bag, claimRequestId: DEMO_IDS.claims.bag, evidenceType: "TEXT", textValue: "Staff requested one more private identifier before deciding the claim.", objectKey: null, mimeType: null, fileSize: null },
  ];

  for (const item of evidence) {
    await prisma.claimEvidence.upsert({ where: { id: item.id }, update: item, create: item });
  }

  // ------------------------------------------------------------
  // 6. Seed inbound Peer API inventory under the existing Medicine Box
  // connection. Its URL, API-key identifier, hash, and status are never
  // created or changed by this dataset.
  // ------------------------------------------------------------
  const partner = await prisma.partnerClient.findUnique({
    where: { name: medicineBoxPartnerName },
    select: { id: true, isActive: true },
  });
  if (!partner || !partner.isActive) {
    throw new Error(
      `The Peer API partner ${medicineBoxPartnerName} is missing or inactive. Connect it in Admin Integrations before running this seed.`
    );
  }

  const syncedAt = new Date("2026-09-13T10:00:00+07:00");
  const peerItems = [
    { id: DEMO_IDS.peerItems.paracetamol, externalId: "medicine-box-paracetamol-500", title: "Paracetamol 500 mg available", category: "Medicine", location: "ABAC Medicine Box, CL Building ground floor", occurredAt: new Date("2026-09-13T09:30:00+07:00"), status: "OPEN", sourceUrl: null, remoteUpdatedAt: new Date("2026-09-13T09:40:00+07:00") },
    { id: DEMO_IDS.peerItems.bandages, externalId: "medicine-box-bandage-pack", title: "Adhesive bandage packs available", category: "First Aid", location: "ABAC Medicine Box, CL Building ground floor", occurredAt: new Date("2026-09-13T09:30:00+07:00"), status: "OPEN", sourceUrl: null, remoteUpdatedAt: new Date("2026-09-13T09:42:00+07:00") },
    { id: DEMO_IDS.peerItems.antiseptic, externalId: "medicine-box-antiseptic-wipes", title: "Antiseptic wipes available", category: "First Aid", location: "ABAC Medicine Box, CL Building ground floor", occurredAt: new Date("2026-09-13T09:30:00+07:00"), status: "OPEN", sourceUrl: null, remoteUpdatedAt: new Date("2026-09-13T09:45:00+07:00") },
    { id: DEMO_IDS.peerItems.oralRehydration, externalId: "medicine-box-oral-rehydration", title: "Oral rehydration salts available", category: "Medicine", location: "ABAC Medicine Box, CL Building ground floor", occurredAt: new Date("2026-09-13T09:30:00+07:00"), status: "OPEN", sourceUrl: null, remoteUpdatedAt: new Date("2026-09-13T09:50:00+07:00") },
  ];

  for (const item of peerItems) {
    await prisma.partnerSyncedItem.upsert({
      where: { partnerId_externalId: { partnerId: partner.id, externalId: item.externalId } },
      update: { ...item, partnerId: partner.id, lastSyncedAt: syncedAt, isActive: true },
      create: { ...item, partnerId: partner.id, lastSyncedAt: syncedAt, isActive: true },
    });
  }

  await prisma.partnerSyncEvent.upsert({
    where: { id: DEMO_IDS.syncEvent },
    update: { operation: "SNAPSHOT", receivedCount: peerItems.length, createdCount: peerItems.length, updatedCount: 0, deactivatedCount: 0, partnerId: partner.id },
    create: { id: DEMO_IDS.syncEvent, operation: "SNAPSHOT", receivedCount: peerItems.length, createdCount: peerItems.length, updatedCount: 0, deactivatedCount: 0, partnerId: partner.id, createdAt: syncedAt },
  });

  // ------------------------------------------------------------
  // 7. Summary
  // ------------------------------------------------------------
  const lostCount = reports.filter(
    (report) => report.reportType === ReportType.LOST
  ).length;

  const foundCount = reports.filter(
    (report) => report.reportType === ReportType.FOUND
  ).length;

  console.log("");
  console.log("Final item report dataset created/refreshed successfully.");
  console.log("");
  console.log(`Lost items: ${lostCount}`);
  console.log(`Found items: ${foundCount}`);
  console.log(`Total item reports: ${reports.length}`);
  console.log(`Categories covered: ${categoryNames.length}`);
  console.log(`Match suggestions: ${matches.length}`);
  console.log(`Claim requests: ${claims.length}`);
  console.log(`Peer API items: ${peerItems.length}`);
  console.log("");
  console.log("Test scenarios:");
  console.log("1. Strong wallet match");
  console.log("2. Possible phone match");
  console.log("3. Strong tablet match");
  console.log("4. Strong laptop match");
  console.log("5. Strong ID-card match");
  console.log("6. Strong key match");
  console.log("7. Partial bottle match");
  console.log("8. Strong bag match");
  console.log("9. Clothing non-match");
  console.log("10. Possible accessory match");
  console.log("11. Electronics weak match");
  console.log("12. Other-category non-match");
  console.log("");
  console.log("The configured admin, student, and staff accounts were validated but not modified.");
  console.log("No user or authentication record was created or modified.");
}

main()
  .catch((error: unknown) => {
    console.error("Final item report data creation failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
