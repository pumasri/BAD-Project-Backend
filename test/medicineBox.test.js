const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MedicineBoxServiceError,
  checkMedicineBoxAvailability,
  createRequestUrl,
  toSafeResult
} = require("../src/services/medicineBox.service");

const item = {
  title: "First-aid kit",
  description: "Private report description that must never be sent to the partner.",
  location: "Building A clinic",
  occurredAt: new Date("2026-09-10T10:00:00.000Z"),
  category: { name: "First Aid" }
};

test("Medicine Box requests match the agreed GET endpoint and category filter", () => {
  const url = createRequestUrl(item, {
    baseUrl: new URL("https://medicine-box.example.edu"),
    path: "/api/peer/clinic/medicines/availability"
  });

  assert.equal(url.toString(), "https://medicine-box.example.edu/api/peer/clinic/medicines/availability?category=First-Aid");
  assert.equal(url.searchParams.has("description"), false);
  assert.equal(url.searchParams.has("title"), false);
  assert.equal(url.searchParams.has("location"), false);
  assert.equal(url.searchParams.has("date"), false);
});

test("Medicine Box result is reduced to safe staff-facing fields", () => {
  assert.deepEqual(toSafeResult({
    data: {
      medicineName: "Sterile bandage",
      quantity: 12,
      unit: "packs",
      stockStatus: "IN_STOCK",
      expiryStatus: "VALID",
      availabilityStatus: "AVAILABLE",
      privateNotes: "Do not retain this"
    }
  }), {
    status: "AVAILABLE",
    supportLocation: null,
    message: "Medicine: Sterile bandage · Quantity: 12 packs · Stock: IN_STOCK · Expiry: VALID"
  });
});

test("Medicine Box client sends the server-side key and handles an available response", async () => {
  let request;
  const result = await checkMedicineBoxAvailability(item, {
    baseUrl: "https://medicine-box.example.edu",
    apiKey: "server-only-test-key",
    path: "/api/peer/clinic/medicines/availability",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ availabilityStatus: "AVAILABLE", medicineName: "Sterile bandage" }), {
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.equal(request.options.headers["x-api-key"], "server-only-test-key");
  assert.equal(request.url.searchParams.get("category"), "First-Aid");
  assert.deepEqual(result, {
    status: "AVAILABLE",
    supportLocation: null,
    message: "Medicine: Sterile bandage"
  });
});

test("Medicine Box client reports missing configuration without exposing secrets", async () => {
  await assert.rejects(
    () => checkMedicineBoxAvailability(item, { baseUrl: "https://medicine-box.example.edu", apiKey: "" }),
    (error) => error instanceof MedicineBoxServiceError && error.code === "MEDICINE_BOX_NOT_CONFIGURED"
  );
});
