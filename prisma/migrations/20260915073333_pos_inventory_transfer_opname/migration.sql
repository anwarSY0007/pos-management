-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockOpnameStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateTable
CREATE TABLE "stock_transfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "receivedById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "stock_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_item" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "stock_transfer_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname" (
    "id" TEXT NOT NULL,
    "opnameNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "StockOpnameStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "stock_opname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname_item" (
    "id" TEXT NOT NULL,
    "opnameId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" DECIMAL(18,3) NOT NULL,
    "countedQty" DECIMAL(18,3),
    "diffQty" DECIMAL(18,3),

    CONSTRAINT "stock_opname_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_transferNumber_key" ON "stock_transfer"("transferNumber");

-- CreateIndex
CREATE INDEX "stock_transfer_fromBranchId_sentAt_idx" ON "stock_transfer"("fromBranchId", "sentAt");

-- CreateIndex
CREATE INDEX "stock_transfer_toBranchId_status_idx" ON "stock_transfer"("toBranchId", "status");

-- CreateIndex
CREATE INDEX "stock_transfer_item_transferId_idx" ON "stock_transfer_item"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_opnameNumber_key" ON "stock_opname"("opnameNumber");

-- CreateIndex
CREATE INDEX "stock_opname_branchId_createdAt_idx" ON "stock_opname"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_opname_item_opnameId_idx" ON "stock_opname_item"("opnameId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_item_opnameId_productId_key" ON "stock_opname_item"("opnameId", "productId");

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_item" ADD CONSTRAINT "stock_opname_item_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_item" ADD CONSTRAINT "stock_opname_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_transfer"
  ADD CONSTRAINT chk_transfer_distinct_branch CHECK ("fromBranchId" <> "toBranchId");

ALTER TABLE "stock_transfer_item"
  ADD CONSTRAINT chk_transfer_qty_positive CHECK ("quantity" > 0);

ALTER TABLE "stock_opname_item"
  ADD CONSTRAINT chk_opname_counted_non_negative CHECK ("countedQty" IS NULL OR "countedQty" >= 0);