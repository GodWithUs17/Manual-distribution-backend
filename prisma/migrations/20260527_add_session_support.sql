-- Migration: Add academic session support with session-aware purchases and serial numbers
-- Generated: 2026-05-27
-- Description: Redesigns purchase model for multi-year student records with session-scoped purchases

-- Step 1: Create AcademicSession enum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'inactive', 'closed');

-- Step 2: Create AcademicSession table
CREATE TABLE "AcademicSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionName" TEXT NOT NULL UNIQUE,
  "startYear" INTEGER NOT NULL,
  "endYear" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'active',
  "registrationOpen" TIMESTAMP(3) NOT NULL,
  "registrationClose" TIMESTAMP(3) NOT NULL,
  "sessionStart" TIMESTAMP(3) NOT NULL,
  "sessionEnd" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for session lookups
CREATE INDEX "AcademicSession_status_idx" ON "AcademicSession"("status");
CREATE INDEX "AcademicSession_sessionStart_idx" ON "AcademicSession"("sessionStart");
CREATE UNIQUE INDEX "AcademicSession_startYear_endYear_key" ON "AcademicSession"("startYear", "endYear");

-- Step 3: Create ReceiptSerialNumber table (atomic counters per session)
CREATE TABLE "ReceiptSerialNumber" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "academicSessionId" TEXT NOT NULL UNIQUE,
  "currentCounter" BIGINT NOT NULL DEFAULT 1,
  "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ReceiptSerialNumber_academicSessionId_fkey" 
    FOREIGN KEY ("academicSessionId") 
    REFERENCES "AcademicSession"("id") 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE
);

CREATE INDEX "ReceiptSerialNumber_academicSessionId_idx" ON "ReceiptSerialNumber"("academicSessionId");

-- Step 4: Create Receipt table (immutable receipt records)
CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "purchaseId" INTEGER NOT NULL UNIQUE,
  "academicSessionId" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL UNIQUE,
  "receiptNumber" BIGINT NOT NULL,
  "qrCodeData" TEXT,
  "pdfUrl" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Receipt_purchaseId_fkey"
    FOREIGN KEY ("purchaseId")
    REFERENCES "Purchase"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  
  CONSTRAINT "Receipt_academicSessionId_fkey"
    FOREIGN KEY ("academicSessionId")
    REFERENCES "AcademicSession"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX "Receipt_purchaseId_idx" ON "Receipt"("purchaseId");
CREATE INDEX "Receipt_academicSessionId_idx" ON "Receipt"("academicSessionId");
CREATE INDEX "Receipt_serialNumber_idx" ON "Receipt"("serialNumber");
CREATE INDEX "Receipt_receiptNumber_idx" ON "Receipt"("receiptNumber");
CREATE INDEX "Receipt_generatedAt_idx" ON "Receipt"("generatedAt");

-- Step 5: Create SessionAnalytic table (session-scoped analytics)
CREATE TABLE "SessionAnalytic" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "academicSessionId" TEXT NOT NULL UNIQUE,
  "totalPurchases" INTEGER NOT NULL DEFAULT 0,
  "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCollected" INTEGER NOT NULL DEFAULT 0,
  "totalRefunded" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalFailed" INTEGER NOT NULL DEFAULT 0,
  "departmentMetrics" JSONB,
  "manualMetrics" JSONB,
  "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "SessionAnalytic_academicSessionId_fkey"
    FOREIGN KEY ("academicSessionId")
    REFERENCES "AcademicSession"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "SessionAnalytic_academicSessionId_idx" ON "SessionAnalytic"("academicSessionId");

-- Step 6: Alter Purchase table to add academicSessionId
ALTER TABLE "Purchase" 
ADD COLUMN "academicSessionId" TEXT;

-- Step 7: Create index on academicSessionId before adding constraint
CREATE INDEX "Purchase_academicSessionId_idx" ON "Purchase"("academicSessionId");

-- Step 8: Add session-scoped unique constraint (replaces old global unique)
-- First, remove old constraint if exists
ALTER TABLE "Purchase" 
DROP CONSTRAINT IF EXISTS "Purchase_matricNo_manualId_key";

-- Add new session-scoped unique constraint
ALTER TABLE "Purchase"
ADD CONSTRAINT "Purchase_academicSessionId_matricNo_manualId_key" 
  UNIQUE("academicSessionId", "matricNo", "manualId");

-- Step 9: Add foreign key for academicSessionId
ALTER TABLE "Purchase" 
ADD CONSTRAINT "Purchase_academicSessionId_fkey" 
  FOREIGN KEY ("academicSessionId") 
  REFERENCES "AcademicSession"("id") 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- Step 10: Update AuditLog to include academicSession context
ALTER TABLE "AuditLog" 
ADD COLUMN "academicSession" TEXT;

CREATE INDEX "AuditLog_academicSession_idx" ON "AuditLog"("academicSession");

-- Step 11: Add additional performance indexes to Purchase
CREATE INDEX "Purchase_academicSessionId_matricNo_idx" ON "Purchase"("academicSessionId", "matricNo");
CREATE INDEX "Purchase_academicSessionId_status_idx" ON "Purchase"("academicSessionId", "status");
CREATE INDEX "Purchase_academicSessionId_collected_idx" ON "Purchase"("academicSessionId", "collected");
CREATE INDEX "Purchase_academicSessionId_createdAt_idx" ON "Purchase"("academicSessionId", "createdAt");
CREATE INDEX "Purchase_academicSessionId_department_idx" ON "Purchase"("academicSessionId", "department");
CREATE INDEX "Purchase_email_idx" ON "Purchase"("email");

-- Step 12: Verify new constraints and indexes
-- This query should show all indexes on Purchase table
-- SELECT indexname FROM pg_indexes WHERE tablename = 'Purchase' ORDER BY indexname;

-- Step 13: Create function for cleanup of expired idempotency keys (if not exists)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM "IdempotencyKey"
  WHERE "expiresAt" < NOW();
END;
$$ LANGUAGE plpgsql;

-- Step 14: Create function to update SessionAnalytic on purchase status change
CREATE OR REPLACE FUNCTION update_session_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id TEXT;
BEGIN
  v_session_id := COALESCE(NEW."academicSessionId", OLD."academicSessionId");
  
  UPDATE "SessionAnalytic"
  SET "lastUpdated" = NOW()
  WHERE "academicSessionId" = v_session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Purchase changes
DROP TRIGGER IF EXISTS "purchase_analytics_trigger" ON "Purchase";
CREATE TRIGGER "purchase_analytics_trigger"
AFTER INSERT OR UPDATE ON "Purchase"
FOR EACH ROW
EXECUTE FUNCTION update_session_analytics();

-- Verification Queries (run these after migration to verify success)
-- 
-- 1. Verify tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('AcademicSession', 'ReceiptSerialNumber', 'Receipt', 'SessionAnalytic');
--
-- 2. Verify Purchase constraints:
-- SELECT constraint_name FROM information_schema.table_constraints 
-- WHERE table_name = 'Purchase' AND constraint_type = 'UNIQUE';
--
-- 3. Verify indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'Purchase' ORDER BY indexname;
--
-- 4. Verify foreign keys:
-- SELECT constraint_name, table_name FROM information_schema.table_constraints
-- WHERE constraint_type = 'FOREIGN KEY' AND table_name IN ('Purchase', 'ReceiptSerialNumber', 'Receipt');

-- Step 15: Grant permissions (if using database user with limited privileges)
-- GRANT SELECT, INSERT, UPDATE ON "AcademicSession" TO api_user;
-- GRANT SELECT, INSERT, UPDATE ON "ReceiptSerialNumber" TO api_user;
-- GRANT SELECT, INSERT ON "Receipt" TO api_user;
-- GRANT SELECT, UPDATE ON "SessionAnalytic" TO api_user;
-- GRANT SELECT, UPDATE ON "Purchase" TO api_user;

-- Migration complete
-- Run this in your application:
-- npx prisma migrate resolve --rolled-back add_academic_sessions (if rolling back)
-- npx prisma migrate deploy (to apply to other environments)

COMMIT;
