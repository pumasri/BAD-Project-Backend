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
  throw new Error("DATABASE_URL is required to create showcase data.");
}

// This seed creates fictional users and a non-live partner connection. It must
// remain a development/staging tool, never a production data operation.
if (process.env.NODE_ENV === "production") {
  throw new Error("Cannot run showcase seed in production environment.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SHOWCASE_IDS = {
  students: {
    narin: "10000000-0000-4000-8000-000000000001",
    pimchanok: "10000000-0000-4000-8000-000000000002",
    thanawat: "10000000-0000-4000-8000-000000000003",
    siriporn: "10000000-0000-4000-8000-000000000004",
  },
  staff: {
    anong: "10000000-0000-4000-8000-000000000101",
    kittipong: "10000000-0000-4000-8000-000000000102",
  },
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
  partner: "60000000-0000-4000-8000-000000000001",
  peerItems: {
    libraryBook: "70000000-0000-4000-8000-000000000001",
    umbrella: "70000000-0000-4000-8000-000000000002",
    headphones: "70000000-0000-4000-8000-000000000003",
    calculator: "70000000-0000-4000-8000-000000000004",
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

type ReportSeed = {
  id: string;
  categoryName: (typeof categoryNames)[number];
  createdById: string;
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
  { id: SHOWCASE_IDS.reports.lostWallet, categoryName: "Wallet", createdById: SHOWCASE_IDS.students.narin, title: "Black zip wallet with a small gold clasp", description: "Slim black zip wallet with a gold clasp and a transit-card sleeve. Lost after an afternoon study session.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, location: "Assumption University Library, 3rd floor silent study area", occurredAt: "2026-09-02T15:20:00+07:00", reportedAt: "2026-09-02T16:05:00+07:00", color: "Black", brand: "Charles & Keith" },
  { id: SHOWCASE_IDS.reports.foundWallet, categoryName: "Wallet", createdById: SHOWCASE_IDS.staff.anong, title: "Black zip wallet handed in at the library desk", description: "A slim black zip wallet with a gold clasp was handed to the Library Service Desk after closing the third-floor study area.", reportType: ReportType.FOUND, status: ReportStatus.CLAIM_IN_PROGRESS, location: "Assumption University Library, 3rd floor service counter", occurredAt: "2026-09-02T15:45:00+07:00", reportedAt: "2026-09-02T16:15:00+07:00", color: "Black", brand: "Charles & Keith" },
  { id: SHOWCASE_IDS.reports.lostPhone, categoryName: "Phone", createdById: SHOWCASE_IDS.students.pimchanok, title: "Blue Android phone with a clear case", description: "Blue Android phone in a clear case with a small pressed-flower insert. It may have been left beside a charging socket.", reportType: ReportType.LOST, status: ReportStatus.OPEN, location: "VMES Building, 10th floor collaboration lounge", occurredAt: "2026-09-04T11:35:00+07:00", reportedAt: "2026-09-04T12:10:00+07:00", color: "Blue", brand: "Samsung" },
  { id: SHOWCASE_IDS.reports.foundPhone, categoryName: "Phone", createdById: SHOWCASE_IDS.staff.kittipong, title: "Black Android phone near the VMES elevators", description: "Black Android phone found beside the elevator seating on the tenth floor. No case was attached when it was received.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, location: "VMES Building, 10th floor elevator lobby", occurredAt: "2026-09-04T12:00:00+07:00", reportedAt: "2026-09-04T12:25:00+07:00", color: "Black", brand: "Samsung" },
  { id: SHOWCASE_IDS.reports.lostTablet, categoryName: "Tablet", createdById: SHOWCASE_IDS.students.thanawat, title: "Silver tablet with a dark blue folio cover", description: "Eleven-inch silver tablet in a dark blue folio cover, used for lecture notes in the afternoon economics class.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, location: "VMES Building, 8th floor Room 810", occurredAt: "2026-09-05T14:40:00+07:00", reportedAt: "2026-09-05T15:05:00+07:00", color: "Silver", brand: "Apple" },
  { id: SHOWCASE_IDS.reports.foundTablet, categoryName: "Tablet", createdById: SHOWCASE_IDS.staff.anong, title: "Silver tablet in a navy folio cover", description: "Silver eleven-inch tablet in a navy folio cover found under a seat after the Room 810 lecture ended.", reportType: ReportType.FOUND, status: ReportStatus.MATCHED, location: "VMES Building, 8th floor Room 810", occurredAt: "2026-09-05T14:55:00+07:00", reportedAt: "2026-09-05T15:20:00+07:00", color: "Silver", brand: "Apple" },
  { id: SHOWCASE_IDS.reports.lostLaptop, categoryName: "Laptop", createdById: SHOWCASE_IDS.students.siriporn, title: "Grey 13-inch laptop in a felt sleeve", description: "Grey 13-inch laptop inside a charcoal felt sleeve with a stitched front document pocket.", reportType: ReportType.LOST, status: ReportStatus.RESOLVED, location: "Student Dormitory A, shared study room", occurredAt: "2026-08-28T20:10:00+07:00", reportedAt: "2026-08-28T20:35:00+07:00", color: "Grey", brand: "Apple" },
  { id: SHOWCASE_IDS.reports.foundLaptop, categoryName: "Laptop", createdById: SHOWCASE_IDS.staff.kittipong, title: "Grey laptop in a charcoal felt sleeve", description: "Grey 13-inch laptop in a charcoal felt sleeve collected from the Dormitory A study-room attendant.", reportType: ReportType.FOUND, status: ReportStatus.RESOLVED, location: "Student Dormitory A, shared study room", occurredAt: "2026-08-28T20:30:00+07:00", reportedAt: "2026-08-28T20:50:00+07:00", color: "Grey", brand: "Apple" },
  { id: SHOWCASE_IDS.reports.lostIdCard, categoryName: "ID Card", createdById: SHOWCASE_IDS.students.narin, title: "University ID card in a clear holder", description: "University ID card in a clear horizontal holder on a black lanyard. The card number is intentionally not shown here.", reportType: ReportType.LOST, status: ReportStatus.RESOLVED, location: "Food Court, north entrance", occurredAt: "2026-08-25T12:15:00+07:00", reportedAt: "2026-08-25T12:35:00+07:00", color: "White", brand: null },
  { id: SHOWCASE_IDS.reports.foundIdCard, categoryName: "ID Card", createdById: SHOWCASE_IDS.staff.anong, title: "University ID card on a black lanyard", description: "University ID card in a clear holder, found by the north entrance tray return and released after identity verification.", reportType: ReportType.FOUND, status: ReportStatus.RESOLVED, location: "Food Court, north entrance", occurredAt: "2026-08-25T12:25:00+07:00", reportedAt: "2026-08-25T12:40:00+07:00", color: "White", brand: null },
  { id: SHOWCASE_IDS.reports.lostKeys, categoryName: "Keys", createdById: SHOWCASE_IDS.students.pimchanok, title: "Three silver keys on a blue woven keychain", description: "Three silver keys on a blue woven keychain with a small round metal tag.", reportType: ReportType.LOST, status: ReportStatus.OPEN, location: "Campus Shuttle stop beside Dormitory B", occurredAt: "2026-09-07T08:05:00+07:00", reportedAt: "2026-09-07T08:30:00+07:00", color: "Silver", brand: null },
  { id: SHOWCASE_IDS.reports.foundKeys, categoryName: "Keys", createdById: SHOWCASE_IDS.staff.kittipong, title: "Blue woven keychain with three silver keys", description: "Blue woven keychain holding three silver keys received from the campus-shuttle driver.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, location: "Campus Shuttle stop beside Dormitory B", occurredAt: "2026-09-07T08:20:00+07:00", reportedAt: "2026-09-07T08:45:00+07:00", color: "Silver", brand: null },
  { id: SHOWCASE_IDS.reports.lostBottle, categoryName: "Bottle", createdById: SHOWCASE_IDS.students.thanawat, title: "Green insulated water bottle", description: "Green insulated water bottle with a black carry loop, left after an evening basketball practice.", reportType: ReportType.LOST, status: ReportStatus.ARCHIVED, location: "Sports Complex, indoor court seating", occurredAt: "2026-07-12T19:10:00+07:00", reportedAt: "2026-07-12T19:40:00+07:00", color: "Green", brand: "Hydro Flask" },
  { id: SHOWCASE_IDS.reports.foundBottle, categoryName: "Bottle", createdById: SHOWCASE_IDS.staff.anong, title: "Green insulated bottle from the indoor court", description: "Green insulated bottle with a black carry loop held for the campus retention period and then donated.", reportType: ReportType.FOUND, status: ReportStatus.DONATED, location: "Sports Complex, indoor court seating", occurredAt: "2026-07-12T19:25:00+07:00", reportedAt: "2026-07-12T19:50:00+07:00", color: "Green", brand: "Hydro Flask" },
  { id: SHOWCASE_IDS.reports.lostBag, categoryName: "Bag", createdById: SHOWCASE_IDS.students.siriporn, title: "Beige canvas tote with a navy book pouch", description: "Beige canvas tote containing a navy book pouch and reusable cutlery case. Lost while moving between the dormitory and library.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, location: "Walkway between Dormitory A and Assumption University Library", occurredAt: "2026-09-01T09:05:00+07:00", reportedAt: "2026-09-01T09:35:00+07:00", color: "Beige", brand: null },
  { id: SHOWCASE_IDS.reports.foundBag, categoryName: "Bag", createdById: SHOWCASE_IDS.staff.kittipong, title: "Beige canvas tote received at the security post", description: "Beige canvas tote with a navy pouch, submitted to the Security Post by a campus groundskeeper.", reportType: ReportType.FOUND, status: ReportStatus.CLAIM_IN_PROGRESS, location: "Walkway between Dormitory A and Assumption University Library", occurredAt: "2026-09-01T09:20:00+07:00", reportedAt: "2026-09-01T09:45:00+07:00", color: "Beige", brand: null },
  { id: SHOWCASE_IDS.reports.lostClothing, categoryName: "Clothing", createdById: SHOWCASE_IDS.students.narin, title: "Cream campus cardigan", description: "Cream knit cardigan with two front pockets, left on a chair after a group presentation.", reportType: ReportType.LOST, status: ReportStatus.ARCHIVED, location: "VMES Building, 6th floor Room 604", occurredAt: "2026-07-18T16:15:00+07:00", reportedAt: "2026-07-18T17:00:00+07:00", color: "Cream", brand: "Uniqlo" },
  { id: SHOWCASE_IDS.reports.foundClothing, categoryName: "Clothing", createdById: SHOWCASE_IDS.staff.anong, title: "Cream knit cardigan from Room 604", description: "Cream knit cardigan retained after a classroom clear-out and disposed of after the approved retention period.", reportType: ReportType.FOUND, status: ReportStatus.DISPOSED, location: "VMES Building, 6th floor Room 604", occurredAt: "2026-07-18T16:35:00+07:00", reportedAt: "2026-07-18T17:10:00+07:00", color: "Cream", brand: "Uniqlo" },
  { id: SHOWCASE_IDS.reports.lostAccessories, categoryName: "Accessories", createdById: SHOWCASE_IDS.students.pimchanok, title: "Rose-gold wireless earbud case", description: "Rose-gold wireless-earbud charging case without the earbuds, possibly left after coffee near the library.", reportType: ReportType.LOST, status: ReportStatus.OPEN, location: "Assumption University Library, ground-floor café tables", occurredAt: "2026-09-06T10:45:00+07:00", reportedAt: "2026-09-06T11:15:00+07:00", color: "Rose gold", brand: "Samsung" },
  { id: SHOWCASE_IDS.reports.foundAccessories, categoryName: "Accessories", createdById: SHOWCASE_IDS.staff.kittipong, title: "Silver wireless earbud case at the library café", description: "Silver wireless-earbud charging case found under a café table. It differs in colour and finish from a nearby lost report.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, location: "Assumption University Library, ground-floor café tables", occurredAt: "2026-09-06T11:00:00+07:00", reportedAt: "2026-09-06T11:25:00+07:00", color: "Silver", brand: "Samsung" },
  { id: SHOWCASE_IDS.reports.lostElectronics, categoryName: "Electronics", createdById: SHOWCASE_IDS.students.thanawat, title: "White USB-C power adapter", description: "White 65W USB-C power adapter with a short black cable, left near a wall outlet during a study session.", reportType: ReportType.LOST, status: ReportStatus.OPEN, location: "VMES Building, 10th floor individual study booths", occurredAt: "2026-09-08T13:25:00+07:00", reportedAt: "2026-09-08T13:55:00+07:00", color: "White", brand: "Anker" },
  { id: SHOWCASE_IDS.reports.foundElectronics, categoryName: "Electronics", createdById: SHOWCASE_IDS.staff.anong, title: "Black USB-C charging cable", description: "Black USB-C charging cable found near the tenth-floor study booths and available for collection.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, location: "VMES Building, 10th floor individual study booths", occurredAt: "2026-09-08T13:45:00+07:00", reportedAt: "2026-09-08T14:05:00+07:00", color: "Black", brand: "Anker" },
  { id: SHOWCASE_IDS.reports.lostOther, categoryName: "Other", createdById: SHOWCASE_IDS.students.siriporn, title: "Folded grey umbrella with a wooden handle", description: "Compact grey umbrella with a curved wooden handle, left at the campus transit waiting area during rain.", reportType: ReportType.LOST, status: ReportStatus.OPEN, location: "Airport Rail Link shuttle waiting area", occurredAt: "2026-09-09T17:40:00+07:00", reportedAt: "2026-09-09T18:10:00+07:00", color: "Grey", brand: null },
  { id: SHOWCASE_IDS.reports.foundOther, categoryName: "Other", createdById: SHOWCASE_IDS.staff.kittipong, title: "Compact grey umbrella from the transit waiting area", description: "Compact grey umbrella with a wooden handle held at the transit desk; the collection window has closed.", reportType: ReportType.FOUND, status: ReportStatus.ARCHIVED, location: "Airport Rail Link shuttle waiting area", occurredAt: "2026-08-01T17:55:00+07:00", reportedAt: "2026-08-01T18:20:00+07:00", color: "Grey", brand: null },
];

async function main() {
  const [studentRole, staffRole] = await Promise.all([
    prisma.role.findUnique({ where: { name: RoleName.STUDENT } }),
    prisma.role.findUnique({ where: { name: RoleName.STAFF } }),
  ]);
  if (!studentRole || !staffRole) {
    throw new Error("Base roles are missing. Run npm run prisma:seed first.");
  }

  const categories = await prisma.itemCategory.findMany({
    where: { name: { in: [...categoryNames] } },
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  const missingCategories = categoryNames.filter((name) => !categoryIdByName.has(name));
  if (missingCategories.length) {
    throw new Error(`Required categories are missing: ${missingCategories.join(", ")}. Run npm run prisma:seed first.`);
  }

  const users = [
    { id: SHOWCASE_IDS.students.narin, universityEmail: "narin.sukjai@example.invalid", fullName: "Narin Sukjai", roleId: studentRole.id },
    { id: SHOWCASE_IDS.students.pimchanok, universityEmail: "pimchanok.rung@example.invalid", fullName: "Pimchanok Rung", roleId: studentRole.id },
    { id: SHOWCASE_IDS.students.thanawat, universityEmail: "thanawat.kaew@example.invalid", fullName: "Thanawat Kaew", roleId: studentRole.id },
    { id: SHOWCASE_IDS.students.siriporn, universityEmail: "siriporn.mali@example.invalid", fullName: "Siriporn Mali", roleId: studentRole.id },
    { id: SHOWCASE_IDS.staff.anong, universityEmail: "anong.prasert@example.invalid", fullName: "Anong Prasert", roleId: staffRole.id },
    { id: SHOWCASE_IDS.staff.kittipong, universityEmail: "kittipong.wong@example.invalid", fullName: "Kittipong Wong", roleId: staffRole.id },
  ];

  await Promise.all(users.map((user) => prisma.user.upsert({
    where: { id: user.id },
    update: { universityEmail: user.universityEmail, fullName: user.fullName, roleId: user.roleId, isActive: true },
    create: { ...user, isActive: true },
  })));

  for (const report of reports) {
    const categoryId = categoryIdByName.get(report.categoryName);
    if (!categoryId) throw new Error(`Category lookup failed for ${report.categoryName}.`);
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
      createdById: report.createdById,
      categoryId,
    };
    await prisma.itemReport.upsert({ where: { id: report.id }, update: data, create: { id: report.id, ...data } });
  }

  const matches = [
    { id: SHOWCASE_IDS.matches.wallet, lostReportId: SHOWCASE_IDS.reports.lostWallet, foundReportId: SHOWCASE_IDS.reports.foundWallet, totalScore: 97.6, descriptionSimilarityScore: 94, categoryScore: 100, colorScore: 100, locationScore: 100, dateScore: 100, confidence: MatchConfidence.HIGH, reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same reported location", "Item was found shortly after the reported loss date"], status: MatchStatus.CLAIMED, matchSource: "AI_ASSISTED", reviewerId: SHOWCASE_IDS.staff.anong, reviewedAt: new Date("2026-09-02T16:20:00+07:00") },
    { id: SHOWCASE_IDS.matches.keys, lostReportId: SHOWCASE_IDS.reports.lostKeys, foundReportId: SHOWCASE_IDS.reports.foundKeys, totalScore: 96.4, descriptionSimilarityScore: 91, categoryScore: 100, colorScore: 100, locationScore: 100, dateScore: 100, confidence: MatchConfidence.HIGH, reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same reported location", "Item was found shortly after the reported loss date"], status: MatchStatus.SUGGESTED, matchSource: "AI_ASSISTED", reviewerId: null, reviewedAt: null },
    { id: SHOWCASE_IDS.matches.tablet, lostReportId: SHOWCASE_IDS.reports.lostTablet, foundReportId: SHOWCASE_IDS.reports.foundTablet, totalScore: 96.8, descriptionSimilarityScore: 92, categoryScore: 100, colorScore: 100, locationScore: 100, dateScore: 100, confidence: MatchConfidence.HIGH, reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same reported location", "Item was found shortly after the reported loss date"], status: MatchStatus.CONFIRMED, matchSource: "MANUAL_STAFF", reviewerId: SHOWCASE_IDS.staff.anong, reviewedAt: new Date("2026-09-05T15:35:00+07:00") },
    { id: SHOWCASE_IDS.matches.laptop, lostReportId: SHOWCASE_IDS.reports.lostLaptop, foundReportId: SHOWCASE_IDS.reports.foundLaptop, totalScore: 98.8, descriptionSimilarityScore: 97, categoryScore: 100, colorScore: 100, locationScore: 100, dateScore: 100, confidence: MatchConfidence.HIGH, reasons: ["Same category", "Descriptions are semantically similar", "Same color", "Same reported location", "Item was found shortly after the reported loss date"], status: MatchStatus.RESOLVED, matchSource: "MANUAL_STAFF", reviewerId: SHOWCASE_IDS.staff.kittipong, reviewedAt: new Date("2026-08-29T10:20:00+07:00") },
    { id: SHOWCASE_IDS.matches.phone, lostReportId: SHOWCASE_IDS.reports.lostPhone, foundReportId: SHOWCASE_IDS.reports.foundPhone, totalScore: 61.9, descriptionSimilarityScore: 41, categoryScore: 100, colorScore: 0, locationScore: 70, dateScore: 100, confidence: MatchConfidence.POSSIBLE, reasons: ["Same category", "Same or nearby reported location", "Item was found shortly after the reported loss date"], status: MatchStatus.REJECTED, matchSource: "MANUAL_STAFF", reviewerId: SHOWCASE_IDS.staff.kittipong, reviewedAt: new Date("2026-09-04T13:10:00+07:00") },
    { id: SHOWCASE_IDS.matches.accessories, lostReportId: SHOWCASE_IDS.reports.lostAccessories, foundReportId: SHOWCASE_IDS.reports.foundAccessories, totalScore: 74.8, descriptionSimilarityScore: 62, categoryScore: 100, colorScore: 0, locationScore: 100, dateScore: 100, confidence: MatchConfidence.POSSIBLE, reasons: ["Same category", "Same reported location", "Item was found shortly after the reported loss date"], status: MatchStatus.SUGGESTED, matchSource: "AI_ASSISTED", reviewerId: null, reviewedAt: null },
  ];

  for (const match of matches) {
    await prisma.matchSuggestion.upsert({
      where: { lostReportId_foundReportId: { lostReportId: match.lostReportId, foundReportId: match.foundReportId } },
      update: match,
      create: match,
    });
  }

  const claims = [
    { id: SHOWCASE_IDS.claims.wallet, claimantUserId: SHOWCASE_IDS.students.narin, foundReportId: SHOWCASE_IDS.reports.foundWallet, reviewedByUserId: null, status: ClaimStatus.PENDING, identifyingDetails: "The wallet has a gold clasp, a transit-card sleeve, and a folded receipt in the centre pocket.", reviewNote: null },
    { id: SHOWCASE_IDS.claims.laptop, claimantUserId: SHOWCASE_IDS.students.siriporn, foundReportId: SHOWCASE_IDS.reports.foundLaptop, reviewedByUserId: SHOWCASE_IDS.staff.kittipong, status: ClaimStatus.APPROVED, identifyingDetails: "The felt sleeve has a stitched front pocket containing a handwritten timetable and a charger pouch.", reviewNote: "Ownership details matched the item. Released to the claimant after staff verification." },
    { id: SHOWCASE_IDS.claims.phone, claimantUserId: SHOWCASE_IDS.students.pimchanok, foundReportId: SHOWCASE_IDS.reports.foundPhone, reviewedByUserId: SHOWCASE_IDS.staff.kittipong, status: ClaimStatus.REJECTED, identifyingDetails: "I believe the phone may be mine because I was on the tenth floor that morning.", reviewNote: "The claimant could not confirm the colour or case details for this item." },
    { id: SHOWCASE_IDS.claims.bag, claimantUserId: SHOWCASE_IDS.students.siriporn, foundReportId: SHOWCASE_IDS.reports.foundBag, reviewedByUserId: SHOWCASE_IDS.staff.anong, status: ClaimStatus.MORE_INFORMATION_REQUIRED, identifyingDetails: "The tote contains a navy pouch and reusable cutlery. I can provide the pouch pattern and the contents if needed.", reviewNote: "Please provide the pattern on the navy pouch and one non-visible item from inside the bag." },
  ];

  for (const claim of claims) {
    await prisma.claimRequest.upsert({ where: { id: claim.id }, update: claim, create: claim });
  }

  const evidence = [
    { id: SHOWCASE_IDS.evidence.wallet, claimRequestId: SHOWCASE_IDS.claims.wallet, evidenceType: "TEXT", textValue: "Claimant described the gold clasp and the internal transit-card sleeve.", objectKey: null, mimeType: null, fileSize: null },
    { id: SHOWCASE_IDS.evidence.laptop, claimRequestId: SHOWCASE_IDS.claims.laptop, evidenceType: "TEXT", textValue: "Claimant accurately described the sleeve pocket and its non-public contents.", objectKey: null, mimeType: null, fileSize: null },
    { id: SHOWCASE_IDS.evidence.phone, claimRequestId: SHOWCASE_IDS.claims.phone, evidenceType: "TEXT", textValue: "Claimant did not provide details consistent with the item received at the desk.", objectKey: null, mimeType: null, fileSize: null },
    { id: SHOWCASE_IDS.evidence.bag, claimRequestId: SHOWCASE_IDS.claims.bag, evidenceType: "TEXT", textValue: "Staff requested an additional non-public identifier before a decision.", objectKey: null, mimeType: null, fileSize: null },
  ];

  for (const item of evidence) {
    await prisma.claimEvidence.upsert({ where: { id: item.id }, update: item, create: item });
  }

  const partner = await prisma.partnerClient.upsert({
    where: { id: SHOWCASE_IDS.partner },
    update: {
      name: "Suvarnabhumi Campus Library Network",
      description: "Fictional public-item exchange used for non-production interface demonstration.",
      baseUrl: "https://library-partner.example.invalid",
      apiKeyIdentifier: "library-network-connector",
      // Deliberately a non-recoverable placeholder hash, not a usable API key.
      apiKeyHash: "01d7c21d5540f026efb6c86d351d9f69d05edc2c7bba132c1b63f1f2d8d25389",
      isActive: true,
    },
    create: {
      id: SHOWCASE_IDS.partner,
      name: "Suvarnabhumi Campus Library Network",
      description: "Fictional public-item exchange used for non-production interface demonstration.",
      baseUrl: "https://library-partner.example.invalid",
      apiKeyIdentifier: "library-network-connector",
      apiKeyHash: "01d7c21d5540f026efb6c86d351d9f69d05edc2c7bba132c1b63f1f2d8d25389",
      isActive: true,
    },
  });

  const syncedAt = new Date("2026-09-10T10:00:00+07:00");
  const peerItems = [
    { id: SHOWCASE_IDS.peerItems.libraryBook, externalId: "sblib-2026-0091", title: "Calculus textbook with a blue cover", category: "Other", location: "Suvarnabhumi Campus Library, 2nd floor returns desk", occurredAt: new Date("2026-09-09T16:10:00+07:00"), status: "OPEN", sourceUrl: "https://library-partner.example.invalid/items/sblib-2026-0091", remoteUpdatedAt: new Date("2026-09-10T09:40:00+07:00") },
    { id: SHOWCASE_IDS.peerItems.umbrella, externalId: "sblib-2026-0092", title: "Navy folding umbrella", category: "Other", location: "Suvarnabhumi Campus Library, ground-floor entrance", occurredAt: new Date("2026-09-09T17:20:00+07:00"), status: "OPEN", sourceUrl: "https://library-partner.example.invalid/items/sblib-2026-0092", remoteUpdatedAt: new Date("2026-09-10T09:42:00+07:00") },
    { id: SHOWCASE_IDS.peerItems.headphones, externalId: "sblib-2026-0093", title: "Black over-ear headphones", category: "Electronics", location: "Suvarnabhumi Campus Library, 3rd floor media booths", occurredAt: new Date("2026-09-08T18:00:00+07:00"), status: "MATCHED", sourceUrl: "https://library-partner.example.invalid/items/sblib-2026-0093", remoteUpdatedAt: new Date("2026-09-10T09:45:00+07:00") },
    { id: SHOWCASE_IDS.peerItems.calculator, externalId: "sblib-2026-0094", title: "Scientific calculator in a clear sleeve", category: "Electronics", location: "Suvarnabhumi Campus Library, 3rd floor group-study room", occurredAt: new Date("2026-09-10T08:35:00+07:00"), status: "CLAIM_IN_PROGRESS", sourceUrl: "https://library-partner.example.invalid/items/sblib-2026-0094", remoteUpdatedAt: new Date("2026-09-10T09:50:00+07:00") },
  ];

  for (const item of peerItems) {
    await prisma.partnerSyncedItem.upsert({
      where: { partnerId_externalId: { partnerId: partner.id, externalId: item.externalId } },
      update: { ...item, partnerId: partner.id, lastSyncedAt: syncedAt, isActive: true },
      create: { ...item, partnerId: partner.id, lastSyncedAt: syncedAt, isActive: true },
    });
  }

  await prisma.partnerSyncEvent.upsert({
    where: { id: SHOWCASE_IDS.syncEvent },
    update: { operation: "SNAPSHOT", receivedCount: peerItems.length, createdCount: peerItems.length, updatedCount: 0, deactivatedCount: 0, partnerId: partner.id },
    create: { id: SHOWCASE_IDS.syncEvent, operation: "SNAPSHOT", receivedCount: peerItems.length, createdCount: peerItems.length, updatedCount: 0, deactivatedCount: 0, partnerId: partner.id, createdAt: syncedAt },
  });

  console.log("Created or refreshed 24 campus reports, 6 match suggestions, 4 claims, and 4 peer inventory records.");
  console.log("All showcase records use internal fixed UUIDs for safe, title-independent cleanup.");
}

main()
  .catch((error: unknown) => {
    console.error("Showcase data creation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
