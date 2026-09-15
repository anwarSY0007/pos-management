import prisma from "@/lib/db";
import {
  requirePermission,
  getSessionContext,
  listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { PosTerminal } from "@/components/pos/pos-terminal";

export default async function PosPage() {
  const ctx = await requirePermission("sale.create");
  if (!ctx) {
    const branches = await listAccessibleBranches(await getSessionContext());
    return <NoBranchPrompt branches={branches} />;
  }

  // Data awal (Server Component) — search lanjutan via /api/pos/products
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 100,
    select: {
      id: true,
      sku: true,
      name: true,
      barcode: true,
      sellingPrice: true,
      taxRate: true,
      unit: { select: { symbol: true } },
      productStocks: {
        where: { branchId: ctx.branchId },
        select: { quantity: true },
      },
    },
  });

  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, creditLimit: true },
    take: 200,
  });

  return (
    <PosTerminal
      cashierName={ctx.name}
      products={products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        price: p.sellingPrice.toString(),
        taxRate: p.taxRate.toString(),
        unit: p.unit?.symbol ?? "",
        stock: p.productStocks[0]?.quantity.toString() ?? null,
      }))}
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        creditLimit: c.creditLimit.toString(),
      }))}
    />
  );
}
