-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'staff');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('pending', 'paid', 'refunded', 'void');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manual" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "courseCode" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "matricNo" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'pending',
    "transactionRef" TEXT,
    "paymentProvider" TEXT,
    "qrToken" TEXT,
    "collected" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMP(3),
    "collectedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_transactionRef_key" ON "Purchase"("transactionRef");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_qrToken_key" ON "Purchase"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_matricNo_manualId_key" ON "Purchase"("matricNo", "manualId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "Manual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
