ALTER TABLE "ReferralReward" ADD COLUMN "appliedAt" TIMESTAMP(3),
ADD COLUMN "appliedInvoiceId" TEXT;

CREATE INDEX "ReferralReward_status_appliedAt_idx" ON "ReferralReward"("status", "appliedAt");

ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_appliedInvoiceId_fkey"
FOREIGN KEY ("appliedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
