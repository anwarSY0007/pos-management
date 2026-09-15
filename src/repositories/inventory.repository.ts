import "server-only";

import prisma from "@/lib/db";
import type { Tx } from "@/lib/db";
import { type Money } from "@/lib/utils/money";

export const inventoryRepository = {
  /** ATOMIC anti-oversell (D16/D17): 1 statement, tanpa check-then-write. */
  decrementIfEnough(tx: Tx, productId: string, branchId: string, qty: Money) {
    return tx.productStock.updateMany({
      where: { productId, branchId, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
  },

  /** ATOMIC increment: create jika belum ada, increment jika sudah (race-safe). */
  incrementOrCreate(tx: Tx, productId: string, branchId: string, qty: Money) {
    return tx.productStock.upsert({
      where: { productId_branchId: { productId, branchId } },
      create: { productId, branchId, quantity: qty },
      update: { quantity: { increment: qty } },
    });
  },

  getStock(productId: string, branchId: string) {
    return prisma.productStock.findUnique({
      where: { productId_branchId: { productId, branchId } },
    });
  },

  /** Overview: katalog × stok branch aktif (LEFT JOIN via include). */
  async listStockOverview(
    branchId: string,
    params: {
      q?: string;
      filter: "all" | "low";
      page: number;
      pageSize: number;
    },
  ) {
    // Filter "low" via raw SQL (banding qty vs minimumStock lintas tabel),
    // lalu hasilnya di-paginate lewat Prisma biasa.
    let lowIds: string[] | null = null;
    if (params.filter === "low") {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT p."id" FROM "product" p
                LEFT JOIN "product_stock" s
                    ON s."productId" = p."id" AND s."branchId" = ${branchId}
                WHERE p."status" = 'ACTIVE'
                    AND s."quantity" IS NOT NULL
                    AND s."quantity" <= p."minimumStock"
                    AND (${params.q ?? ""} = '' OR p."name" ILIKE ${"%" + (params.q ?? "") + "%"} OR p."sku" ILIKE ${"%" + (params.q ?? "") + "%"})
                ORDER BY (s."quantity" - p."minimumStock") ASC, p."name" ASC
            `;
      lowIds = rows.map((r) => r.id);
      if (lowIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: params.page,
          pageSize: params.pageSize,
          pageCount: 1,
        };
      }
    }

    const where = {
      status: "ACTIVE" as const,
      ...(lowIds ? { id: { in: lowIds } } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" as const } },
              { sku: { contains: params.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          sku: true,
          name: true,
          purchasePrice: true,
          minimumStock: true,
          unit: { select: { symbol: true } },
          productStocks: { where: { branchId }, select: { quantity: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items: products.map((p) => ({
        ...p,
        stock: p.productStocks[0]?.quantity ?? null,
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
  },

  async listMovements(
    branchId: string,
    params: { q?: string; type?: string; page: number; pageSize: number },
  ) {
    const where = {
      branchId,
      ...(params.type ? { type: params.type as never } : {}),
      ...(params.q
        ? {
            product: {
              OR: [
                { name: { contains: params.q, mode: "insensitive" as const } },
                { sku: { contains: params.q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          product: { select: { sku: true, name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
  },

  // ===== TRANSFER =====
  findTransferById(id: string) {
    return prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, purchasePrice: true },
            },
          },
        },
        fromBranch: { select: { id: true, code: true, name: true } },
        toBranch: { select: { id: true, code: true, name: true } },
      },
    });
  },

  async listTransfers(branchId: string, params: { status: string }) {
    const where = {
      OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
      ...(params.status !== "ALL" ? { status: params.status as never } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.stockTransfer.findMany({
        where,
        orderBy: { sentAt: "desc" },
        take: 50,
        include: {
          fromBranch: { select: { id: true, code: true, name: true } },
          toBranch: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);
    return { items, total };
  },

  // ===== OPNAME =====
  findOpnameById(id: string) {
    return prisma.stockOpname.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, purchasePrice: true },
            },
          },
        },
        branch: { select: { code: true, name: true } },
        createdBy: { select: { id: true, name: true } }, // ← tambah (dipakai juga nanti)
        completedBy: { select: { id: true, name: true } }, // ← INI yang hilang
      },
    });
  },

  async listOpnames(branchId: string, params: { status: string }) {
    const where = {
      branchId,
      ...(params.status !== "ALL" ? { status: params.status as never } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.stockOpname.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockOpname.count({ where }),
    ]);
    return { items, total };
  },
};
