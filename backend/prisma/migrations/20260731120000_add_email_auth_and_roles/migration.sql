-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "commissionBazario" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "refreshToken",
ADD COLUMN     "emailEncrypted" BYTEA,
ADD COLUMN     "emailHash" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "refreshTokenEncrypted" BYTEA,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'BUYER',
ADD COLUMN     "sellerFeePaid" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "users_emailHash_key" ON "users"("emailHash");
