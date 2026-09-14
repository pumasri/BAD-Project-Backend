-- 1. Unlink demo finder from any real records they reviewed
UPDATE "ClaimRequest"
SET "reviewedByUserId" = NULL
WHERE "reviewedByUserId" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu');

UPDATE "MatchSuggestion"
SET "reviewerId" = NULL
WHERE "reviewerId" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu');

-- 2. Delete ClaimEvidence related to demo claims
DELETE FROM "ClaimEvidence"
WHERE "claimRequestId" IN (
  SELECT id FROM "ClaimRequest"
  WHERE "foundReportId" IN (
    SELECT id FROM "ItemReport" WHERE title LIKE 'DEMO: %' OR "createdById" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu')
  )
  OR "claimantUserId" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu')
);

-- 3. Delete ClaimRequest related to demo reports or created by demo user
DELETE FROM "ClaimRequest"
WHERE "foundReportId" IN (
  SELECT id FROM "ItemReport" WHERE title LIKE 'DEMO: %' OR "createdById" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu')
)
OR "claimantUserId" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu');

-- 4. Delete MatchSuggestion related to demo reports
DELETE FROM "MatchSuggestion"
WHERE "lostReportId" IN (
  SELECT id FROM "ItemReport" WHERE title LIKE 'DEMO: %' OR "createdById" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu')
)
OR "foundReportId" IN (
  SELECT id FROM "ItemReport" WHERE title LIKE 'DEMO: %' OR "createdById" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu')
)
OR "matchSource" = 'DEMO_DATA';

-- 5. Delete ItemImage related to demo reports
DELETE FROM "ItemImage"
WHERE "reportId" IN (
  SELECT id FROM "ItemReport" WHERE title LIKE 'DEMO: %' OR "createdById" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu')
);

-- 6. Delete AuditLog created by demo user
DELETE FROM "AuditLog"
WHERE "actorUserId" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu');

-- 7. Delete ItemReport created by demo user or with DEMO: prefix
DELETE FROM "ItemReport"
WHERE title LIKE 'DEMO: %' OR "createdById" IN (SELECT id FROM "User" WHERE email = 'demo.finder@au.edu');

-- 8. Delete the demo finder user
DELETE FROM "User"
WHERE email = 'demo.finder@au.edu';
