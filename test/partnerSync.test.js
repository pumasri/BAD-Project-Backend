const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parsePartnerSyncPayload,
  parsePositiveLimit,
  toOutboundPeerItem,
  toPartnerSyncedItem
} = require("../src/services/partnerSync");

function validPayload(overrides = {}) {
  return {
    items: [{
      externalId: "library-wallet-204",
      title: "Black wallet",
      category: "Wallet",
      location: "Library service desk",
      occurredAt: "2026-08-30T09:15:00.000Z",
      status: "OPEN",
      sourceUrl: "https://library.example.edu/lost-found/library-wallet-204",
      updatedAt: "2026-08-30T10:00:00.000Z",
      ...overrides
    }]
  };
}

test("partner sync accepts the documented public item shape", () => {
  const parsed = parsePartnerSyncPayload(validPayload());
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.items[0].externalId, "library-wallet-204");

  const record = toPartnerSyncedItem(parsed.data.items[0], "partner-id", new Date("2026-08-30T11:00:00.000Z"));
  assert.equal(record.partnerId, "partner-id");
  assert.equal(record.title, "Black wallet");
  assert.equal(record.remoteUpdatedAt.toISOString(), "2026-08-30T10:00:00.000Z");
});

test("partner sync rejects unexpected personal or claim data", () => {
  const parsed = parsePartnerSyncPayload(validPayload({ reporterEmail: "student@au.edu" }));
  assert.equal(parsed.success, false);
  assert.equal(parsed.message, "Invalid partner sync payload");
});

test("partner sync rejects duplicate IDs and invalid item states", () => {
  const duplicate = validPayload();
  duplicate.items.push({ ...duplicate.items[0] });
  assert.equal(parsePartnerSyncPayload(duplicate).success, false);

  assert.equal(parsePartnerSyncPayload(validPayload({ status: "RESOLVED" })).success, false);
});

test("snapshot mode can deliberately deactivate a partner's missing records", () => {
  const snapshot = parsePartnerSyncPayload({ mode: "SNAPSHOT", items: [] });
  assert.equal(snapshot.success, true);
  assert.equal(snapshot.data.mode, "SNAPSHOT");
  assert.equal(parsePartnerSyncPayload({ mode: "UPSERT", items: [] }).success, false);
});

test("outbound feed produces a payload that the peer sync endpoint accepts", () => {
  const outbound = toOutboundPeerItem({
    id: "0dc162de-0f2f-4cc6-9f2c-c79d1f169a8e",
    title: "Found keys",
    category: { name: "Keys" },
    location: "Building A reception",
    occurredAt: new Date("2026-08-29T12:00:00.000Z"),
    status: "OPEN",
    updatedAt: new Date("2026-08-30T12:00:00.000Z")
  });

  const parsed = parsePartnerSyncPayload({ items: [outbound] });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.items[0].category, "Keys");
});

test("peer list limits are bounded", () => {
  assert.deepEqual(parsePositiveLimit(undefined), { success: true, value: 50 });
  assert.deepEqual(parsePositiveLimit("100"), { success: true, value: 100 });
  assert.equal(parsePositiveLimit("101").success, false);
  assert.equal(parsePositiveLimit("one").success, false);
});
