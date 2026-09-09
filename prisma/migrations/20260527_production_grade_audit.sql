-- Production-Grade Payment System Migration
-- Adds audit logging, idempotency keys, and webhook tracking

-- Create AuditLog table
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "staffId" INTEGER,
    "purchaseId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes on AuditLog
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_staffId_idx" ON "AuditLog"("staffId");
CREATE INDEX "AuditLog_purchaseId_idx" ON "AuditLog"("purchaseId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- Add foreign key
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_staffId_fkey" 
  FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_purchaseId_fkey" 
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create IdempotencyKey table
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "transactionRef" TEXT,
    "response" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- Create unique index on key
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- Create indexes for expiration cleanup
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- Create WebhookLog table
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "txRef" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- Create unique index on webhookId
CREATE UNIQUE INDEX "WebhookLog_webhookId_key" ON "WebhookLog"("webhookId");

-- Create indexes for lookups
CREATE INDEX "WebhookLog_txRef_idx" ON "WebhookLog"("txRef");
CREATE INDEX "WebhookLog_event_idx" ON "WebhookLog"("event");

-- Update Purchase table status enum to include 'failed'
-- This requires PostgreSQL-specific ALTER TYPE
ALTER TYPE "PurchaseStatus" ADD VALUE 'failed' BEFORE 'refunded';

-- Add indexes to Purchase table for critical queries
CREATE INDEX "Purchase_transactionRef_idx" ON "Purchase"("transactionRef");
CREATE INDEX "Purchase_qrToken_idx" ON "Purchase"("qrToken");
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");
CREATE INDEX "Purchase_matricNo_manualId_idx" ON "Purchase"("matricNo", "manualId");
CREATE INDEX "Purchase_status_collected_idx" ON "Purchase"("status", "collected");
CREATE INDEX "Purchase_collectedById_collectedAt_idx" ON "Purchase"("collectedById", "collectedAt");

-- Add index to User table for lookups
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- Create table to track cleanup of expired idempotency keys
-- (Optional: for monitoring when cleanup happens)
CREATE TABLE "IdempotencyKeyCleanup" (
    "id" SERIAL PRIMARY KEY,
    "deletedCount" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create function to delete expired idempotency keys
-- Run this daily via cron job
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS TABLE(deleted_count integer) AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    DELETE FROM "IdempotencyKey" WHERE "expiresAt" < NOW();
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    INSERT INTO "IdempotencyKeyCleanup" ("deletedCount") VALUES (v_deleted_count);
    
    RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- (Adjust user names and permissions as needed)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO "api_user";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "api_user";

-- Migrate existing Purchase data to handle new status enum
-- (Run after ALTER TYPE if existing data needs updating)
-- UPDATE "Purchase" SET "status" = 'failed' WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days';

-- Verify migration completed successfully
SELECT 
    'AuditLog' as table_name, COUNT(*) as row_count FROM "AuditLog"
UNION ALL
SELECT 
    'IdempotencyKey' as table_name, COUNT(*) as row_count FROM "IdempotencyKey"
UNION ALL
SELECT 
    'WebhookLog' as table_name, COUNT(*) as row_count FROM "WebhookLog";

-- Check indexes were created
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('Purchase', 'AuditLog', 'IdempotencyKey', 'WebhookLog');
