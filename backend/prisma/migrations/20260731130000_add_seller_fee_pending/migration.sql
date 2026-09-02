-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sellerFeePending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellerFeePendingAt" TIMESTAMP(3),
ADD COLUMN     "sellerFeeRef" TEXT,
ADD COLUMN     "sellerFeeProvider" TEXT;
