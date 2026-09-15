import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma/client";
import { inventoryService } from "../src/services/inventory.service";
import type { AuthorizedContext } from "../src/lib/permissions/authorize";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("🧪 Concurrency test: 2× ADJUSTMENT_OUT paralel pada stok = 1");

  // --- Setup: cabang + produk + stok awal 1 ---
  const branch = await prisma.branch.create({
    data: { code: `TST-${Date.now()}`, name: "Cabang Test Concurrency" },
  });
  const user = await prisma.user.findFirstOrThrow({
    where: { role: "WAREHOUSE" },
  });
  const product = await prisma.product.create({
    data: {
      sku: `TST-${Date.now()}`,
      name: "Produk Test Concurrency",
      purchasePrice: "10000",
      sellingPrice: "15000",
      minimumStock: "0",
    },
  });

  const ctx: AuthorizedContext = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: "WAREHOUSE",
    isSuperAdmin: false,
    activeBranchId: branch.id,
    branchId: branch.id,
  };

  await inventoryService.initializeStock(ctx, {
    productId: product.id,
    qty: "1",
    note: "setup test",
  });

  // --- Fire 2 parallel OUT ---
  const results = await Promise.allSettled([
    inventoryService.adjust(ctx, {
      productId: product.id,
      direction: "OUT",
      qty: "1",
      note: "kasir A",
    }),
    inventoryService.adjust(ctx, {
      productId: product.id,
      direction: "OUT",
      qty: "1",
      note: "kasir B",
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult[];
  const stock = await prisma.productStock.findUniqueOrThrow({
    where: {
      productId_branchId: { productId: product.id, branchId: branch.id },
    },
  });
  const movements = await prisma.stockMovement.count({
    where: { productId: product.id, branchId: branch.id },
  });
  const journals = await prisma.journalEntry.count({
    where: { branchId: branch.id, sourceType: "STOCK_ADJUSTMENT" },
  });

  // --- Assert ---
  const errors: string[] = [];
  if (fulfilled !== 1) errors.push(`Harus tepat 1 sukses, dapat ${fulfilled}`);
  // ✅ BLOK BARU — baca properti .code, bukan String():
  const reasons = rejected.map(
    (r) => r.reason as { code?: string; message?: string },
  );

  if (rejected.length !== 1 || reasons[0]?.code !== "INSUFFICIENT_STOCK") {
    errors.push(
      `Harus 1 gagal INSUFFICIENT_STOCK, dapat: ${reasons
        .map((r) => `${r.code ?? "?"}: ${r.message ?? "?"}`)
        .join(" | ")}`,
    );
  }
  if (!stock.quantity.eq(0))
    errors.push(`Stok akhir harus 0, dapat ${stock.quantity}`);
  if (movements !== 2)
    errors.push(`Movement harus 2 (initial+adjust), dapat ${movements}`);
  if (journals !== 1)
    errors.push(`Jurnal adjustment harus 1, dapat ${journals}`);

  // --- Cleanup ---
  await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
  await prisma.journalEntry.deleteMany({ where: { branchId: branch.id } });
  await prisma.productStock.deleteMany({ where: { productId: product.id } });
  await prisma.documentSequence.deleteMany({ where: { branchId: branch.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.branch.delete({ where: { id: branch.id } });

  if (errors.length > 0) {
    console.error("❌ GAGAL:");
    for (const e of errors) console.error("  -", e);
    process.exit(1);
  }
  console.log(
    "✅ LULUS: tidak ada oversell, movement & jurnal konsisten, rollback bersih.",
  );
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
