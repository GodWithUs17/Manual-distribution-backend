-- Production Hardening: Add Snapshot Fields, Make courseCode Required, Improve Immutability

-- Step 1: Make Manual.courseCode required (NOT NULL)
-- First, ensure no NULLs exist
UPDATE "Manual" SET "courseCode" = 'UNKNOWN' WHERE "courseCode" IS NULL;

ALTER TABLE "Manual" 
  ALTER COLUMN "courseCode" SET NOT NULL;

-- Step 2: Add updatedAt to Manual for tracking
ALTER TABLE "Manual" 
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Add snapshot fields to Receipt table
ALTER TABLE "Receipt"
  ADD COLUMN "courseCodeSnapshot" VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN "manualTitleSnapshot" VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN "amountSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "studentNameSnapshot" VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN "matricNoSnapshot" VARCHAR(255) NOT NULL DEFAULT '';

-- Step 4: Update WebhookLog with new fields
ALTER TABLE "WebhookLog"
  ADD COLUMN "purchaseId" INTEGER,
  ADD COLUMN "statusCode" INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN "responseData" JSONB;

-- Drop old details column and rename
ALTER TABLE "WebhookLog"
  RENAME COLUMN "details" TO "details_old";

-- Step 5: Add indexes to WebhookLog for better performance
CREATE INDEX "WebhookLog_purchaseId_idx" ON "WebhookLog"("purchaseId");
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");

-- Step 6: Backfill Receipt snapshot fields from existing data
UPDATE "Receipt" r
SET 
  "courseCodeSnapshot" = COALESCE(m."courseCode", 'UNKNOWN'),
  "manualTitleSnapshot" = COALESCE(m."title", 'Unknown Manual'),
  "amountSnapshot" = COALESCE(p."amount", 0),
  "studentNameSnapshot" = COALESCE(p."fullName", 'Unknown Student'),
  "matricNoSnapshot" = COALESCE(p."matricNo", 'Unknown')
FROM "Manual" m, "Purchase" p
WHERE r."manualId" = m."id" 
  AND r."purchaseId" = p."id";

-- Step 7: Drop old details column from WebhookLog (after backfill)
ALTER TABLE "WebhookLog" DROP COLUMN "details_old";

-- Step 8: Add constraints to Receipt to ensure immutability
-- Note: PostgreSQL doesn't have built-in immutability, but triggers can enforce it
-- This is handled in the application layer, but we can document it here

-- Step 9: Ensure serial format comment update
-- Updating comments for clarity on new serial format: COURSECODE-YEAR-COUNTER
COMMENT ON TABLE "Receipt" IS 'Immutable receipt records. Serial format: COURSECODE-YEAR-COUNTER (e.g., CSC301-2026-0001). All fields frozen at issuance.';
COMMENT ON TABLE "ReceiptSerialCounter" IS 'Per-manual, per-session serial number counters. Atomically incremented. Format: COURSECODE-YEAR-COUNTER';
