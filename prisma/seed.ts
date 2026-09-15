import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma/client";
import { hashPassword } from "better-auth/crypto";

/**
 * Development seed — IDEMPOTENT (aman dijalankan ulang).
 *
 * DEVELOPMENT-ONLY CREDENTIALS:
 *   password untuk semua user: Passw0rd!
 *   JANGAN dipakai di production.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEV_PASSWORD = "Passw0rd!";

const DEV_USERS = [
    { name: "Super Admin", email: "superadmin@example.com", role: "SUPER_ADMIN" },
    { name: "Owner", email: "owner@example.com", role: "OWNER" },
    { name: "Admin Cabang", email: "admin@example.com", role: "ADMIN" },
    { name: "Kasir", email: "cashier@example.com", role: "CASHIER" },
    { name: "Gudang", email: "warehouse@example.com", role: "WAREHOUSE" },
] as const;

const BRANCHES = [
    { code: "PST", name: "Toko Pusat", address: "Jl. Raya No. 1", phone: "021-1111" },
    { code: "JKT01", name: "Cabang Jakarta", address: "Jl. Jakarta No. 10", phone: "021-2222" },
] as const;

// user → branch codes (first = default)
const USER_BRANCHES: Record<string, readonly string[]> = {
    "superadmin@example.com": ["PST", "JKT01"],
    "owner@example.com": ["PST", "JKT01"],
    "admin@example.com": ["PST"],
    "cashier@example.com": ["PST"],
    "warehouse@example.com": ["PST"],
};

const CHART_OF_ACCOUNTS = [
  { code: "1-1000", name: "Kas", type: "ASSET" },
  { code: "1-1100", name: "Bank", type: "ASSET" },
  { code: "1-1200", name: "Piutang Usaha", type: "ASSET" },
  { code: "1-1300", name: "Persediaan Barang", type: "ASSET" },
  { code: "2-1000", name: "Utang Usaha", type: "LIABILITY" },
  { code: "2-1100", name: "Utang PPN Keluaran", type: "LIABILITY" },
  { code: "3-1000", name: "Modal Pemilik", type: "EQUITY" },
  { code: "4-1000", name: "Pendapatan Penjualan", type: "REVENUE" },
  { code: "4-9000", name: "Pendapatan Lain-lain", type: "REVENUE" },
  { code: "5-1000", name: "Harga Pokok Penjualan", type: "EXPENSE" },
  { code: "5-9000", name: "Selisih Persediaan", type: "EXPENSE" },
  { code: "6-1000", name: "Beban Gaji", type: "EXPENSE" },
  { code: "6-1100", name: "Beban Sewa", type: "EXPENSE" },
  { code: "6-1200", name: "Beban Listrik & Air", type: "EXPENSE" },
  { code: "6-1300", name: "Beban Internet & Telepon", type: "EXPENSE" },
  { code: "6-1400", name: "Beban Transport", type: "EXPENSE" },
  { code: "6-1500", name: "Beban Maintenance", type: "EXPENSE" },
  { code: "6-9000", name: "Beban Operasional Lain", type: "EXPENSE" },
] as const;

async function main() {
  console.log("🌱 Seeding development data...");

  // 1. Branches
  const branchIds = new Map<string, string>();
  for (const b of BRANCHES) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: {},
      create: {
        code: b.code,
        name: b.name,
        address: b.address,
        phone: b.phone,
      },
    });
    branchIds.set(b.code, branch.id);
  }
  console.log(`  ✔ ${BRANCHES.length} branches`);

  // 2. Chart of Accounts
  for (const a of CHART_OF_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: a.code },
      update: {},
      create: { code: a.code, name: a.name, type: a.type },
    });
  }
  console.log(`  ✔ ${CHART_OF_ACCOUNTS.length} chart of accounts`);

  // 3. Users + credential accounts (langsung via Prisma —
  //    BUKAN signUpEmail, agar tidak kena rate limit 5/5 menit)
  const userIds = new Map<string, string>();
  const passwordHash = await hashPassword(DEV_PASSWORD);

  for (const u of DEV_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: {
        id: randomUUID(),
        name: u.name,
        email: u.email,
        role: u.role,
        emailVerified: true,
      },
    });
    userIds.set(u.email, user.id);

    await prisma.account.upsert({
      where: { id: `${user.id}-credential` },
      update: { password: passwordHash },
      create: {
        id: `${user.id}-credential`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }
  console.log(`  ✔ ${DEV_USERS.length} users (password: ${DEV_PASSWORD})`);

  // 4. UserBranch assignments
  for (const [email, branchCodes] of Object.entries(USER_BRANCHES)) {
    const userId = userIds.get(email);
    if (!userId) continue;
    for (const code of branchCodes) {
      const branchId = branchIds.get(code);
      if (!branchId) continue;
      await prisma.userBranch.upsert({
        where: { userId_branchId: { userId, branchId } },
        update: {},
        create: { userId, branchId, isDefault: false },
      });
    }
  }
  console.log("  ✔ user-branch assignments");

  const CATEGORIES = ["Minuman", "Makanan", "Snack", "Alat Tulis"];
  const UNITS = [
    { name: "Pieces", symbol: "pcs" },
    { name: "Box", symbol: "box" },
    { name: "Kilogram", symbol: "kg" },
    { name: "Liter", symbol: "ltr" },
  ];
  const BRANDS = ["Umum", "Merek A", "Merek B"];

  const catId = new Map<string, string>();
  for (const name of CATEGORIES) {
    const c = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    catId.set(name, c.id);
  }
  const unitId = new Map<string, string>();
  for (const u of UNITS) {
    const un = await prisma.unit.upsert({
      where: { name: u.name },
      update: {},
      create: u,
    });
    unitId.set(u.name, un.id);
  }
  const brandId = new Map<string, string>();
  for (const name of BRANDS) {
    const b = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    brandId.set(name, b.id);
  }

  const PRODUCTS = [
    {
      sku: "SKU-0001",
      name: "Air Mineral 600ml",
      cat: "Minuman",
      unit: "Pieces",
      brand: "Umum",
      pp: "2500",
      sp: "4000",
      min: "24",
      tax: "11",
    },
    {
      sku: "SKU-0002",
      name: "Kopi Sachet",
      cat: "Minuman",
      unit: "Pieces",
      brand: "Merek A",
      pp: "1200",
      sp: "2000",
      min: "48",
      tax: "11",
    },
    {
      sku: "SKU-0003",
      name: "Mie Instan Goreng",
      cat: "Makanan",
      unit: "Pieces",
      brand: "Merek A",
      pp: "2800",
      sp: "3500",
      min: "72",
      tax: "11",
    },
    {
      sku: "SKU-0004",
      name: "Biskuit Cokelat",
      cat: "Snack",
      unit: "Box",
      brand: "Merek B",
      pp: "8500",
      sp: "11000",
      min: "12",
      tax: "11",
    },
    {
      sku: "SKU-0005",
      name: "Keripik Kentang",
      cat: "Snack",
      unit: "Pieces",
      brand: "Merek B",
      pp: "7000",
      sp: "9500",
      min: "24",
      tax: "11",
    },
    {
      sku: "SKU-0006",
      name: "Pulpen Gel",
      cat: "Alat Tulis",
      unit: "Pieces",
      brand: "Umum",
      pp: "2000",
      sp: "3500",
      min: "36",
      tax: "0",
    },
    {
      sku: "SKU-0007",
      name: "Buku Tulis 38 lbr",
      cat: "Alat Tulis",
      unit: "Pieces",
      brand: "Umum",
      pp: "3500",
      sp: "5000",
      min: "24",
      tax: "0",
    },
    {
      sku: "SKU-0008",
      name: "Teh Kotak 250ml",
      cat: "Minuman",
      unit: "Pieces",
      brand: "Merek A",
      pp: "3800",
      sp: "5000",
      min: "24",
      tax: "11",
    },
  ];

  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        categoryId: catId.get(p.cat)!,
        unitId: unitId.get(p.unit)!,
        brandId: brandId.get(p.brand)!,
        purchasePrice: p.pp,
        sellingPrice: p.sp,
        minimumStock: p.min,
        taxRate: p.tax,
      },
    });
  }
  console.log(`  ✔ ${PRODUCTS.length} products`);

  const CUSTOMERS = [
    {
      customerCode: "CUS-0001",
      name: "Toko Berkah",
      phone: "0812-1111-2222",
      creditLimit: "5000000",
    },
    {
      customerCode: "CUS-0002",
      name: "Warung Bu Sari",
      phone: "0813-3333-4444",
      creditLimit: "1000000",
    },
    {
      customerCode: "CUS-0003",
      name: "Kantin Sekolah",
      phone: "0815-5555-6666",
      creditLimit: "0",
    },
  ];
  for (const c of CUSTOMERS) {
    await prisma.customer.upsert({
      where: { customerCode: c.customerCode },
      update: {},
      create: c,
    });
  }
  const SUPPLIERS = [
    {
      supplierCode: "SUP-0001",
      name: "PT Distribusi Sejahtera",
      phone: "021-7777-8888",
    },
    {
      supplierCode: "SUP-0002",
      name: "CV Sumber Pangan",
      phone: "021-9999-0000",
    },
  ];
  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { supplierCode: s.supplierCode },
      update: {},
      create: s,
    });
  }
  console.log("  ✔ customers & suppliers");
  // 1b. Default cash & bank accounts per branch — VERSI BERSIH
  const branchRows = await prisma.branch.findMany();
  for (const b of branchRows) {
    const existingCash = await prisma.cashAccount.findFirst({
      where: { branchId: b.id, type: "CASH" },
    });
    if (!existingCash) {
      await prisma.cashAccount.create({
        data: {
          branchId: b.id,
          name: `Kas ${b.code}`,
          type: "CASH",
          currentBalance: "0",
        },
      });
    }
    const existingBank = await prisma.cashAccount.findFirst({
      where: { branchId: b.id, type: "BANK" },
    });
    if (!existingBank) {
      await prisma.cashAccount.create({
        data: {
          branchId: b.id,
          name: `Bank ${b.code}`,
          type: "BANK",
          currentBalance: "0",
        },
      });
    }
  }
  console.log("  ✔ default kas & bank per cabang");

  console.log("✅ Seed selesai.");
  console.log(`
=== DEVELOPMENT CREDENTIALS (JANGAN dipakai di production) ===
  superadmin@example.com  / ${DEV_PASSWORD}   (SUPER_ADMIN)
  owner@example.com       / ${DEV_PASSWORD}   (OWNER)
  admin@example.com       / ${DEV_PASSWORD}   (ADMIN)
  cashier@example.com     / ${DEV_PASSWORD}   (CASHIER)
  warehouse@example.com   / ${DEV_PASSWORD}   (WAREHOUSE)
==============================================================`);
}

main()
    .catch((e) => {
        console.error("❌ Seed gagal:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });