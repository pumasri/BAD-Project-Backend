# Partner synchronisation API

The peer API shares only public found-item metadata. It never exchanges local
users, email addresses, claims, claim evidence, uploaded files, or item
descriptions. Each partner receives a unique secret from an administrator and
must provide it in every request:

```http
x-api-key: <partner-secret>
```

All endpoints are under `/api/peer`. A secret identifies one active partner;
deactivating that partner immediately prevents access.

## Outbound feed: `GET /api/peer/items`

Returns public, available local **found** reports only. It is intentionally
limited to 100 records per request and excludes reporter details and images.

Optional query parameters:

- `limit` - integer from 1 to 100; default 50.
- `updatedAfter` - ISO-8601 date/time. Only records updated after this instant
  are returned.

```json
{
  "success": true,
  "count": 1,
  "items": [
    {
      "externalId": "0dc162de-0f2f-4cc6-9f2c-c79d1f169a8e",
      "title": "Found keys",
      "category": "Keys",
      "location": "Building A reception",
      "occurredAt": "2026-08-29T12:00:00.000Z",
      "status": "OPEN",
      "updatedAt": "2026-08-30T12:00:00.000Z"
    }
  ]
}
```

## Inbound synchronisation: `POST /api/peer/sync`

Sends up to 100 public item records. The combination of the authenticated
partner and `externalId` is the idempotency key: sending the same record again
updates the stored record instead of creating a duplicate. A complete batch is
written in one transaction and creates a `PartnerSyncEvent` record.

By default, use `"mode": "UPSERT"`; the request must have at least one item.
Use `"mode": "SNAPSHOT"` for a complete replacement of the active partner
inventory. A snapshot may have no items and automatically deactivates records
that were previously received from that partner but are absent from the batch.

Allowed fields per item are exactly:

| Field | Required | Rules |
|---|---:|---|
| `externalId` | Yes | 1-128 characters: letters, numbers, `.`, `_`, `:`, `-` |
| `title` | Yes | 1-160 characters |
| `category` | No | 1-80 characters or `null` |
| `location` | Yes | 1-160 characters |
| `occurredAt` | Yes | ISO-8601 date/time |
| `status` | No | `OPEN`, `MATCHED`, or `CLAIM_IN_PROGRESS`; default `OPEN` |
| `sourceUrl` | No | HTTP(S) URL to the partner's own public item page |
| `updatedAt` | No | ISO-8601 date/time |

Unknown fields are rejected. In particular, do not send names, email addresses,
student IDs, claims, evidence, images, or free-form private descriptions.

```json
{
  "mode": "SNAPSHOT",
  "items": [
    {
      "externalId": "library-wallet-204",
      "title": "Black wallet",
      "category": "Wallet",
      "location": "Library service desk",
      "occurredAt": "2026-08-30T09:15:00.000Z",
      "status": "OPEN",
      "sourceUrl": "https://library.example.edu/lost-found/library-wallet-204",
      "updatedAt": "2026-08-30T10:00:00.000Z"
    }
  ]
}
```

## Stored partner inventory: `GET /api/peer/synced-items`

Returns the authenticated partner's own records already stored by this system.
It supports optional `limit`, `q` (title/location text), `category`, and
`location` filters. This endpoint cannot return another partner's data.

Administrators can inspect a partner's stored public inventory through
`GET /api/admin/partners/:id/synced-items?limit=50`. The Admin API Integrations
page also shows stored-item counts and the latest sync time.
