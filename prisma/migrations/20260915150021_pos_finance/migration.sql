-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('SALE', 'PURCHASE', 'EXPENSE', 'RECEIVABLE_PAYMENT', 'PAYABLE_PAYMENT', 'TRANSFER', 'ADJUSTMENT', 'OTHER');

-- CreateTable
CREATE TABLE "cash_account" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CashAccountType" NOT NULL,
    "accountNumber" TEXT,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "CashTransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expenseAccount" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "attachmentUrl" TEXT,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivable_payment" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receivable_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_payment" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payable_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_account_branchId_idx" ON "cash_account"("branchId");

-- CreateIndex
CREATE INDEX "cash_transaction_accountId_createdAt_idx" ON "cash_transaction"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_transaction_branchId_createdAt_idx" ON "cash_transaction"("branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "expense_expenseNumber_key" ON "expense"("expenseNumber");

-- CreateIndex
CREATE INDEX "expense_branchId_expenseDate_idx" ON "expense"("branchId", "expenseDate");

-- CreateIndex
CREATE INDEX "expense_expenseAccount_idx" ON "expense"("expenseAccount");

-- CreateIndex
CREATE INDEX "receivable_payment_receivableId_idx" ON "receivable_payment"("receivableId");

-- CreateIndex
CREATE INDEX "payable_payment_payableId_idx" ON "payable_payment"("payableId");

-- AddForeignKey
ALTER TABLE "cash_account" ADD CONSTRAINT "cash_account_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "cash_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "cash_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "cash_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payment" ADD CONSTRAINT "payable_payment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payment" ADD CONSTRAINT "payable_payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "cash_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payment" ADD CONSTRAINT "payable_payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- D48: saldo tidak boleh minus; transaksi kas tidak boleh nol
ALTER TABLE "cash_account" ADD CONSTRAINT chk_cash_balance CHECK ("currentBalance" >= 0);
ALTER TABLE "cash_transaction" ADD CONSTRAINT chk_cash_txn_nonzero CHECK ("amount" <> 0);
ALTER TABLE "expense" ADD CONSTRAINT chk_expense_amount CHECK ("amount" > 0);
ALTER TABLE "receivable_payment" ADD CONSTRAINT chk_recv_pay CHECK ("amount" > 0);
ALTER TABLE "payable_payment" ADD CONSTRAINT chk_pay_pay CHECK ("amount" > 0);
