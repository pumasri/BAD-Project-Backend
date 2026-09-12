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
  throw new Error("DATABASE_URL is required to create peer demo data.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEMO_PREFIX = "DEMO DATA:";
const peerVisibleStatuses = new Set<ReportStatus>([
  ReportStatus.OPEN,
  ReportStatus.MATCHED,
  ReportStatus.CLAIM_IN_PROGRESS,
]);

type DemoReport = {
  key: string;
  title: string;
  description: string;
  reportType: ReportType;
  status: ReportStatus;
  category: string;
  location: string;
  occurredAt: string;
  color: string | null;
  brand: string | null;
};

const reports: DemoReport[] = [
  { key: "lost-wallet-black", title: "TEST DATA: Lost black leather wallet", description: "Black leather zip wallet with a small gold zipper, last seen after study group.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, category: "Wallet", location: "AU Library, second floor", occurredAt: "2026-09-01T10:15:00+07:00", color: "Black", brand: "Charles & Keith" },
  { key: "lost-iphone", title: "TEST DATA: Lost black iPhone 15", description: "Black iPhone 15 with a clear case and a small star sticker on the back.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, category: "Phone", location: "Student Center lounge", occurredAt: "2026-09-02T12:10:00+07:00", color: "Black", brand: "Apple" },
  { key: "lost-nike-backpack", title: "TEST DATA: Lost blue Nike backpack", description: "Navy blue Nike backpack containing notebooks and a reusable water bottle.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, category: "Bag", location: "Building A, room 302", occurredAt: "2026-09-03T15:20:00+07:00", color: "Navy", brand: "Nike" },
  { key: "lost-id-card", title: "TEST DATA: Lost AU student ID card", description: "University student ID card in a transparent holder with a blue lanyard.", reportType: ReportType.LOST, status: ReportStatus.CLAIM_IN_PROGRESS, category: "ID Card", location: "Cafeteria checkout", occurredAt: "2026-09-04T12:40:00+07:00", color: "White", brand: null },
  { key: "lost-keys", title: "TEST DATA: Lost silver keys with blue keychain", description: "Three silver keys on a blue fabric keychain, including one small mailbox key.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, category: "Keys", location: "Cathedral of Learning entrance", occurredAt: "2026-09-05T08:35:00+07:00", color: "Silver", brand: null },
  { key: "lost-airpods", title: "TEST DATA: Lost white AirPods", description: "White AirPods in their charging case, left near a computer workstation.", reportType: ReportType.LOST, status: ReportStatus.MATCHED, category: "Electronics", location: "Computer lab, Building B", occurredAt: "2026-09-05T16:10:00+07:00", color: "White", brand: "Apple" },
  { key: "lost-ipad", title: "TEST DATA: Lost silver iPad", description: "Silver iPad with a dark blue magnetic cover used during a lecture.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Tablet", location: "Lecture Hall C", occurredAt: "2026-09-06T11:30:00+07:00", color: "Silver", brand: "Apple" },
  { key: "lost-laptop-sleeve", title: "TEST DATA: Lost grey laptop sleeve", description: "Grey 13-inch laptop sleeve with a notebook in the front pocket.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Laptop", location: "Library group-study room", occurredAt: "2026-09-06T18:00:00+07:00", color: "Grey", brand: null },
  { key: "lost-bottle", title: "TEST DATA: Lost green water bottle", description: "Green insulated water bottle with a black flip lid.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Bottle", location: "Fitness center", occurredAt: "2026-09-07T07:15:00+07:00", color: "Green", brand: "Hydro Flask" },
  { key: "lost-hoodie", title: "TEST DATA: Lost red university hoodie", description: "Red AU hoodie with a small embroidered logo on the left sleeve.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Clothing", location: "Bus and shuttle area", occurredAt: "2026-09-07T17:40:00+07:00", color: "Red", brand: null },
  { key: "lost-glasses", title: "TEST DATA: Lost black-frame glasses", description: "Prescription glasses with black rectangular frames in a hard case.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Accessories", location: "Chapel seating area", occurredAt: "2026-09-08T09:10:00+07:00", color: "Black", brand: null },
  { key: "lost-umbrella", title: "TEST DATA: Lost compact umbrella", description: "Foldable black umbrella with a wooden curved handle.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Other", location: "Dormitory lobby", occurredAt: "2026-09-08T20:15:00+07:00", color: "Black", brand: null },
  { key: "lost-samsung", title: "TEST DATA: Lost blue Samsung phone", description: "Blue Samsung Galaxy phone in a navy protective case.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Phone", location: "Canteen", occurredAt: "2026-09-09T13:10:00+07:00", color: "Blue", brand: "Samsung" },
  { key: "lost-brown-wallet", title: "TEST DATA: Lost brown canvas wallet", description: "Brown canvas wallet with a zipper and a transit-card pocket.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Wallet", location: "Parking area", occurredAt: "2026-09-09T14:25:00+07:00", color: "Brown", brand: null },
  { key: "lost-tote-bag", title: "TEST DATA: Lost cream tote bag", description: "Cream canvas tote bag with a printed bookshop design.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Bag", location: "Cafeteria", occurredAt: "2026-09-10T12:05:00+07:00", color: "Cream", brand: null },
  { key: "lost-key-fob", title: "TEST DATA: Lost car key fob", description: "Black car key fob on a metal ring with one house key.", reportType: ReportType.LOST, status: ReportStatus.OPEN, category: "Keys", location: "Student Center reception", occurredAt: "2026-09-10T16:30:00+07:00", color: "Black", brand: null },
  { key: "lost-resolved-id", title: "TEST DATA: Lost card holder already returned", description: "Black card holder previously reported missing and returned to its owner.", reportType: ReportType.LOST, status: ReportStatus.RESOLVED, category: "ID Card", location: "Library service desk", occurredAt: "2026-08-20T11:00:00+07:00", color: "Black", brand: null },
  { key: "lost-donated-clothing", title: "TEST DATA: Lost yellow rain jacket", description: "Yellow rain jacket unclaimed after the required holding period.", reportType: ReportType.LOST, status: ReportStatus.DONATED, category: "Clothing", location: "Dormitory laundry room", occurredAt: "2026-05-12T08:00:00+07:00", color: "Yellow", brand: null },
  { key: "lost-disposed-mouse", title: "TEST DATA: Lost damaged wireless mouse", description: "Black wireless mouse with a cracked battery cover.", reportType: ReportType.LOST, status: ReportStatus.DISPOSED, category: "Electronics", location: "Computer lab, Building B", occurredAt: "2026-04-14T15:45:00+07:00", color: "Black", brand: "Logitech" },
  { key: "lost-archived-tablet", title: "TEST DATA: Archived tablet report", description: "Old tablet report retained only for record keeping after the case closed.", reportType: ReportType.LOST, status: ReportStatus.ARCHIVED, category: "Tablet", location: "Lecture Hall D", occurredAt: "2026-03-03T09:30:00+07:00", color: "Silver", brand: null },

  { key: "found-wallet-black", title: "TEST DATA: Found black leather wallet", description: "Black leather zip wallet with a small gold zipper found near the library study tables.", reportType: ReportType.FOUND, status: ReportStatus.MATCHED, category: "Wallet", location: "AU Library, second floor", occurredAt: "2026-09-01T12:30:00+07:00", color: "Black", brand: "Charles & Keith" },
  { key: "found-iphone", title: "TEST DATA: Found black iPhone 15", description: "Black iPhone 15 in a clear case with a small star sticker, handed to the desk.", reportType: ReportType.FOUND, status: ReportStatus.MATCHED, category: "Phone", location: "Student Center lounge", occurredAt: "2026-09-02T12:45:00+07:00", color: "Black", brand: "Apple" },
  { key: "found-nike-backpack", title: "TEST DATA: Found navy Nike backpack", description: "Navy Nike backpack containing notebooks, found after a class in Building A.", reportType: ReportType.FOUND, status: ReportStatus.MATCHED, category: "Bag", location: "Building A, room 302", occurredAt: "2026-09-03T16:10:00+07:00", color: "Navy", brand: "Nike" },
  { key: "found-id-card", title: "TEST DATA: Found AU student ID card", description: "AU student ID card in a transparent holder with a blue lanyard, kept at the desk for verification.", reportType: ReportType.FOUND, status: ReportStatus.CLAIM_IN_PROGRESS, category: "ID Card", location: "Cafeteria checkout", occurredAt: "2026-09-04T13:05:00+07:00", color: "White", brand: null },
  { key: "found-keys", title: "TEST DATA: Found silver keys with blue keychain", description: "Three silver keys on a blue fabric keychain handed in at the Lost and Found desk.", reportType: ReportType.FOUND, status: ReportStatus.MATCHED, category: "Keys", location: "Cathedral of Learning entrance", occurredAt: "2026-09-05T09:00:00+07:00", color: "Silver", brand: null },
  { key: "found-airpods-case", title: "TEST DATA: Found white AirPods case", description: "White Apple AirPods charging case found near a computer workstation; earbuds were not inside.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Electronics", location: "Computer lab, Building B", occurredAt: "2026-09-05T16:45:00+07:00", color: "White", brand: "Apple" },
  { key: "found-ipad", title: "TEST DATA: Found silver iPad with blue cover", description: "Silver iPad with a dark blue cover found after a lecture in Hall C.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Tablet", location: "Lecture Hall C", occurredAt: "2026-09-06T13:15:00+07:00", color: "Silver", brand: "Apple" },
  { key: "found-laptop-sleeve", title: "TEST DATA: Found black laptop sleeve", description: "Black 15-inch laptop sleeve with no contents, found at a library study table.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Laptop", location: "AU Library, first floor", occurredAt: "2026-09-08T10:00:00+07:00", color: "Black", brand: null },
  { key: "found-bottle", title: "TEST DATA: Found green insulated bottle", description: "Green insulated bottle with a black flip lid left near the fitness-center lockers.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Bottle", location: "Fitness center", occurredAt: "2026-09-07T08:00:00+07:00", color: "Green", brand: "Hydro Flask" },
  { key: "found-hoodie", title: "TEST DATA: Found red AU hoodie", description: "Red university hoodie found on a bus-shuttle seat after the afternoon route.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Clothing", location: "Bus and shuttle area", occurredAt: "2026-09-07T18:05:00+07:00", color: "Red", brand: null },
  { key: "found-glasses", title: "TEST DATA: Found black-frame glasses", description: "Black rectangular glasses in a hard case, found close to the chapel seating area.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Accessories", location: "Chapel seating area", occurredAt: "2026-09-08T09:35:00+07:00", color: "Black", brand: null },
  { key: "found-umbrella", title: "TEST DATA: Found navy umbrella", description: "Navy foldable umbrella with a plastic handle, unrelated to the black umbrella report.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Other", location: "Dormitory lobby", occurredAt: "2026-09-08T20:45:00+07:00", color: "Navy", brand: null },
  { key: "found-samsung", title: "TEST DATA: Found blue Samsung phone", description: "Blue Samsung Galaxy phone in a navy protective case received from the canteen.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Phone", location: "Canteen", occurredAt: "2026-09-09T13:40:00+07:00", color: "Blue", brand: "Samsung" },
  { key: "found-brown-wallet", title: "TEST DATA: Found brown canvas wallet", description: "Brown canvas wallet with no cards found in the parking area.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Wallet", location: "Parking area", occurredAt: "2026-09-10T09:00:00+07:00", color: "Brown", brand: null },
  { key: "found-tote-bag", title: "TEST DATA: Found cream tote bag", description: "Cream canvas tote bag with a printed bookshop design, found at the cafeteria.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Bag", location: "Cafeteria", occurredAt: "2026-09-10T12:30:00+07:00", color: "Cream", brand: null },
  { key: "found-key-fob", title: "TEST DATA: Found black car key fob", description: "Black car key fob on a metal ring with one house key, held at Student Center reception.", reportType: ReportType.FOUND, status: ReportStatus.OPEN, category: "Keys", location: "Student Center reception", occurredAt: "2026-09-10T16:45:00+07:00", color: "Black", brand: null },
  { key: "found-resolved-card-holder", title: "TEST DATA: Returned black card holder", description: "Black card holder already verified and returned to its owner.", reportType: ReportType.FOUND, status: ReportStatus.RESOLVED, category: "ID Card", location: "Library service desk", occurredAt: "2026-08-20T11:30:00+07:00", color: "Black", brand: null },
  { key: "found-donated-jacket", title: "TEST DATA: Donated yellow rain jacket", description: "Yellow rain jacket unclaimed past the holding period and approved for donation.", reportType: ReportType.FOUND, status: ReportStatus.DONATED, category: "Clothing", location: "Dormitory laundry room", occurredAt: "2026-05-12T09:00:00+07:00", color: "Yellow", brand: null },
  { key: "found-disposed-mouse", title: "TEST DATA: Disposed damaged wireless mouse", description: "Damaged black wireless mouse disposed according to the Lost and Found policy.", reportType: ReportType.FOUND, status: ReportStatus.DISPOSED, category: "Electronics", location: "Computer lab, Building B", occurredAt: "2026-04-14T16:30:00+07:00", color: "Black", brand: "Logitech" },
  { key: "found-archived-tablet", title: "TEST DATA: Archived tablet case", description: "Closed tablet case retained as an archived historical record.", reportType: ReportType.FOUND, status: ReportStatus.ARCHIVED, category: "Tablet", location: "Lecture Hall D", occurredAt: "2026-03-03T10:00:00+07:00", color: "Silver", brand: null },
];

type SeededReport = { id: string; key: string };

async function upsertReport(
  report: DemoReport,
  createdById: string,
  categoryId: string,
): Promise<SeededReport> {
  const title = `${DEMO_PREFIX} ${report.title.replace(/^[A-Z ]+DATA:\s*/, "")}`;
  const data = {
    title,
    description: report.description,
    reportType: report.reportType,
    status: report.status,
    location: report.location,
    occurredAt: new Date(report.occurredAt),
    color: report.color,
    brand: report.brand,
    isPublic: report.reportType === ReportType.FOUND && peerVisibleStatuses.has(report.status),
    createdById,
    categoryId,
  };

  const existing = await prisma.itemReport.findFirst({
    where: { title, createdById },
    select: { id: true },
  });
  const saved = existing
    ? await prisma.itemReport.update({ where: { id: existing.id }, data })
    : await prisma.itemReport.create({ data });

  return { id: saved.id, key: report.key };
}

async function upsertMatch(
  reportsByKey: Map<string, SeededReport>,
  lostKey: string,
  foundKey: string,
  totalScore: number,
  confidence: MatchConfidence,
  reasons: string[],
) {
  const lost = reportsByKey.get(lostKey);
  const found = reportsByKey.get(foundKey);
  if (!lost || !found) throw new Error(`Missing demo reports for match ${lostKey} -> ${foundKey}`);

  const score = Math.round(totalScore * 100) / 100;
  await prisma.matchSuggestion.upsert({
    where: { lostReportId_foundReportId: { lostReportId: lost.id, foundReportId: found.id } },
    update: {
      totalScore: score,
      descriptionSimilarityScore: score,
      categoryScore: 100,
      colorScore: score >= 80 ? 100 : score >= 70 ? 75 : 0,
      locationScore: score >= 80 ? 100 : score >= 70 ? 70 : 40,
      dateScore: score >= 80 ? 100 : 80,
      confidence,
      status: MatchStatus.SUGGESTED,
      reasons,
      matchSource: "PEER_DEMO_DATA",
      reviewerId: null,
      reviewedAt: null,
    },
    create: {
      lostReportId: lost.id,
      foundReportId: found.id,
      totalScore: score,
      descriptionSimilarityScore: score,
      categoryScore: 100,
      colorScore: score >= 80 ? 100 : score >= 70 ? 75 : 0,
      locationScore: score >= 80 ? 100 : score >= 70 ? 70 : 40,
      dateScore: score >= 80 ? 100 : 80,
      confidence,
      status: MatchStatus.SUGGESTED,
      reasons,
      matchSource: "PEER_DEMO_DATA",
    },
  });
}

async function main() {
  const [studentRole, staffRole] = await Promise.all([
    prisma.role.findUnique({ where: { name: RoleName.STUDENT } }),
    prisma.role.findUnique({ where: { name: RoleName.STAFF } }),
  ]);
  if (!studentRole || !staffRole) {
    throw new Error("Base roles are missing. Run npm run prisma:seed before npm run seed:peer-demo.");
  }

  const categories = await prisma.itemCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));
  const missingCategories = [...new Set(reports.map((report) => report.category))]
    .filter((name) => !categoryByName.has(name));
  if (missingCategories.length) {
    throw new Error(`Missing active categories: ${missingCategories.join(", ")}. Run npm run prisma:seed first.`);
  }

  const [demoStudent, demoStaff] = await Promise.all([
    prisma.user.upsert({
      where: { universityEmail: "peer.demo.student@au.edu" },
      update: { fullName: "Peer Demo Student", username: "peer-demo-student", universityId: "PEER-DEMO-STUDENT", isActive: true, roleId: studentRole.id },
      create: { universityEmail: "peer.demo.student@au.edu", fullName: "Peer Demo Student", username: "peer-demo-student", universityId: "PEER-DEMO-STUDENT", isActive: true, roleId: studentRole.id },
    }),
    prisma.user.upsert({
      where: { universityEmail: "peer.demo.staff@au.edu" },
      update: { fullName: "Peer Demo Lost and Found Desk", username: "peer-demo-staff", universityId: "PEER-DEMO-STAFF", isActive: true, roleId: staffRole.id },
      create: { universityEmail: "peer.demo.staff@au.edu", fullName: "Peer Demo Lost and Found Desk", username: "peer-demo-staff", universityId: "PEER-DEMO-STAFF", isActive: true, roleId: staffRole.id },
    }),
  ]);

  const reportsByKey = new Map<string, SeededReport>();
  for (const report of reports) {
    const createdById = report.reportType === ReportType.LOST ? demoStudent.id : demoStaff.id;
    const categoryId = categoryByName.get(report.category);
    if (!categoryId) throw new Error(`Category lookup failed for ${report.category}`);
    const saved = await upsertReport(report, createdById, categoryId);
    reportsByKey.set(saved.key, saved);
  }

  await Promise.all([
    upsertMatch(reportsByKey, "lost-wallet-black", "found-wallet-black", 95, MatchConfidence.HIGH, ["Strong match: same wallet type, color, brand, location, and date"]),
    upsertMatch(reportsByKey, "lost-iphone", "found-iphone", 94, MatchConfidence.HIGH, ["Strong match: same phone model, color, case detail, location, and date"]),
    upsertMatch(reportsByKey, "lost-nike-backpack", "found-nike-backpack", 92, MatchConfidence.HIGH, ["Strong match: same backpack brand, color, location, and date"]),
    upsertMatch(reportsByKey, "lost-id-card", "found-id-card", 74, MatchConfidence.POSSIBLE, ["Possible match: same ID-card category, holder, lanyard color, and location"]),
    upsertMatch(reportsByKey, "lost-keys", "found-keys", 78, MatchConfidence.POSSIBLE, ["Possible match: same number of keys, keychain color, location, and date"]),
    upsertMatch(reportsByKey, "lost-airpods", "found-airpods-case", 64, MatchConfidence.POSSIBLE, ["Partial match: same product family and location, but only the charging case was found"]),
    upsertMatch(reportsByKey, "lost-ipad", "found-ipad", 76, MatchConfidence.POSSIBLE, ["Possible match: same tablet brand, color, cover, lecture hall, and nearby time"]),
    upsertMatch(reportsByKey, "lost-laptop-sleeve", "found-laptop-sleeve", 61, MatchConfidence.POSSIBLE, ["Weak match: both are laptop sleeves, but differ in color, size, location, and date"]),
  ]);

  const foundIdCard = reportsByKey.get("found-id-card");
  if (!foundIdCard) throw new Error("Missing demo found ID card report.");
  const existingClaim = await prisma.claimRequest.findFirst({
    where: { claimantUserId: demoStudent.id, foundReportId: foundIdCard.id },
    select: { id: true },
  });
  const claimData = {
    status: ClaimStatus.PENDING,
    identifyingDetails: "DEMO DATA: The card is in a transparent holder with a blue lanyard and was lost at the cafeteria.",
    reviewNote: null,
  };
  if (existingClaim) {
    await prisma.claimRequest.update({ where: { id: existingClaim.id }, data: claimData });
  } else {
    await prisma.claimRequest.create({
      data: { ...claimData, claimantUserId: demoStudent.id, foundReportId: foundIdCard.id },
    });
  }

  const [lostCount, foundCount, peerVisibleFoundCount, categoryCount] = await Promise.all([
    prisma.itemReport.count({ where: { createdById: demoStudent.id, title: { startsWith: DEMO_PREFIX }, reportType: ReportType.LOST } }),
    prisma.itemReport.count({ where: { createdById: demoStaff.id, title: { startsWith: DEMO_PREFIX }, reportType: ReportType.FOUND } }),
    prisma.itemReport.count({
      where: {
        createdById: demoStaff.id,
        title: { startsWith: DEMO_PREFIX },
        reportType: ReportType.FOUND,
        isPublic: true,
        status: { in: [...peerVisibleStatuses] },
      },
    }),
    prisma.itemCategory.count({ where: { name: { in: [...new Set(reports.map((report) => report.category))] } } }),
  ]);

  console.log("Peer demo data seeded successfully.");
  console.log(`Lost items: ${lostCount}`);
  console.log(`Found items: ${foundCount}`);
  console.log("Matching demo cases: 8 (3 strong, 4 possible, 1 weak/partial)");
  console.log(`Categories used: ${categoryCount}`);
  console.log(`Peer API-visible found items: ${peerVisibleFoundCount}`);
  console.log("Only DEMO DATA: records and peer.demo.* users were created or refreshed.");
}

main()
  .catch((error: unknown) => {
    console.error("Peer demo data seeding failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
