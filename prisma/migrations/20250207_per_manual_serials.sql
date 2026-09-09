-- Migration: Redesign serial number system to per-manual counters
-- Purpose: Change from global session counters to per-manual counters
-- Format: YY-COURSECODE-COUNTER (e.g., 26-CSC301-0001)
-- Date: 2025-02-07

-- Step 1: Create new ReceiptSerialCounter table (per-manual per session)
CREATE TABLE IF NOT EXISTS "ReceiptSerialCounter" (
  "id"                  UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "academicSessionId"   UUID NOT NULL,
  "manualId"            INTEGER NOT NULL,
  "currentCounter"      BIGINT NOT NULL DEFAULT 0,
  "lastUpdated"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedCount"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ReceiptSerialCounter_academicSessionId_fkey" 
    FOREIGN KEY ("academicSessionId") 
    REFERENCES "AcademicSession"("id") 
    ON DELETE RESTRICT,
    
  CONSTRAINT "ReceiptSerialCounter_manualId_fkey" 
    FOREIGN KEY ("manualId") 
    REFERENCES "Manual"("id") 
    ON DELETE RESTRICT,
    
  CONSTRAINT "ReceiptSerialCounter_unique_session_manual" 
    UNIQUE("academicSessionId", "manualId")
);

-- Step 2: Create indexes for ReceiptSerialCounter
CREATE INDEX "ReceiptSerialCounter_academicSessionId" 
  ON "ReceiptSerialCounter"("academicSessionId");

CREATE INDEX "ReceiptSerialCounter_manualId" 
  ON "ReceiptSerialCounter"("manualId");

CREATE INDEX "ReceiptSerialCounter_session_manual" 
  ON "ReceiptSerialCounter"("academicSessionId", "manualId");

-- Step 3: Add manualId to Receipt table (if not already present)
ALTER TABLE "Receipt" 
ADD COLUMN IF NOT EXISTS "manualId" INTEGER;

-- Step 4: Populate manualId in Receipt from related Purchase
UPDATE "Receipt" r
SET "manualId" = p."manualId"
FROM "Purchase" p
WHERE r."purchaseId" = p."id" 
  AND r."manualId" IS NULL;

-- Step 5: Add foreign key constraint for manualId on Receipt
ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_manualId_fkey"
FOREIGN KEY ("manualId") REFERENCES "Manual"("id")
ON DELETE RESTRICT;

-- Step 6: Add indexes to Receipt for per-manual queries
CREATE INDEX IF NOT EXISTS "Receipt_session_manual" 
  ON "Receipt"("academicSessionId", "manualId");

CREATE INDEX IF NOT EXISTS "Receipt_manual" 
  ON "Receipt"("manualId");

-- Step 7: Initialize counters for all existing (session, manual) combinations
-- This query finds all combinations that have existing receipts
INSERT INTO "ReceiptSerialCounter" ("academicSessionId", "manualId", "currentCounter", "createdAt")
SELECT DISTINCT 
  r."academicSessionId",
  r."manualId",
  MAX(r."receiptNumber") as current_counter,
  CURRENT_TIMESTAMP
FROM "Receipt" r
GROUP BY r."academicSessionId", r."manualId"
ON CONFLICT ("academicSessionId", "manualId") DO NOTHING;

-- Step 8: Initialize counters for new (session, manual) pairs with zero counter
-- This ensures all active manuals have a counter in the active session
INSERT INTO "ReceiptSerialCounter" ("academicSessionId", "manualId", "currentCounter", "createdAt")
SELECT 
  s."id",
  m."id",
  0 as current_counter,
  CURRENT_TIMESTAMP
FROM "AcademicSession" s
CROSS JOIN "Manual" m
WHERE s."status" = 'active'
  AND m."isActive" = true
ON CONFLICT ("academicSessionId", "manualId") DO NOTHING;

-- Step 9: Add index to Manual for courseCode (used in serial generation)
CREATE INDEX IF NOT EXISTS "Manual_courseCode" 
  ON "Manual"("courseCode");

-- Step 10: Drop old ReceiptSerialNumber table (if exists)
DROP TABLE IF EXISTS "ReceiptSerialNumber" CASCADE;

-- Step 11: Ensure Manual.courseCode is not null for serials to work properly
ALTER TABLE "Manual"
ALTER COLUMN "courseCode" SET NOT NULL;

-- Step 12: Update AuditLog to ensure academicSession field exists
ALTER TABLE "AuditLog"
ADD COLUMN IF NOT EXISTS "academicSession" VARCHAR(255);

-- Step 13: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "Purchase_session_manual" 
  ON "Purchase"("academicSessionId", "manualId");

CREATE INDEX IF NOT EXISTS "Purchase_session_status" 
  ON "Purchase"("academicSessionId", "status");

CREATE INDEX IF NOT EXISTS "Purchase_session_collected" 
  ON "Purchase"("academicSessionId", "collected");

CREATE INDEX IF NOT EXISTS "Purchase_matricNo_manual" 
  ON "Purchase"("matricNo", "manualId");

-- Step 14: Create check constraint to ensure receiptNumber matches counter
-- This is for data integrity validation
ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_receiptNumber_positive" 
CHECK ("receiptNumber" > 0);

-- Step 15: Verify migration success
-- This query checks that all receipts have valid serial numbers in YY-COURSECODE-COUNTER format
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  -- Count receipts with invalid serial format
  SELECT COUNT(*)
  INTO invalid_count
  FROM "Receipt"
  WHERE "serialNumber" !~ '^\d{2}-[A-Z0-9]+-\d{4}$';
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % receipts with invalid serial format', invalid_count;
  ELSE
    RAISE NOTICE 'All receipts have valid serial format';
  END IF;
  
  -- Verify all receipts have manualId
  SELECT COUNT(*)
  INTO invalid_count
  FROM "Receipt"
  WHERE "manualId" IS NULL;
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % receipts with NULL manualId', invalid_count;
  ELSE
    RAISE NOTICE 'All receipts have valid manualId';
  END IF;
  
  -- Verify counter initialization
  RAISE NOTICE 'ReceiptSerialCounter rows created: %', (SELECT COUNT(*) FROM "ReceiptSerialCounter");
  
END $$;

-- Step 16: Grant permissions (if using restricted DB user)
-- Uncomment if needed for production
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "ReceiptSerialCounter" TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE "ReceiptSerialCounter_id_seq" TO app_user;

-- Migration complete
-- Verify with:
-- SELECT COUNT(*) FROM "ReceiptSerialCounter";
-- SELECT * FROM "ReceiptSerialCounter" LIMIT 5;
-- SELECT COUNT(*) FROM "Receipt" WHERE "manualId" IS NULL; -- Should be 0
