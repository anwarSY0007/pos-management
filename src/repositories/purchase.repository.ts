import "server-only";

import prisma from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

const DETAIL_INCLUDE = {
  items: {
    include: { product: { select: { id: true, sku: true, name: true } } },
  },
  supplier: { select: { id: true, supplierCode: true, name: true } },
  createdBy: { select: { name: true } },
  payable: {
    select: { id: true, amount: true, paidAmount: true, status: true },
  },
} satisfies Prisma.PurchaseInclude;

export const purchaseRepository = {
  findById(id: string) {
    return prisma.purchase.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
  },

  async list(
    branchId: string,
    params: { q?: string; status: string; page: number; pageSize: number },
  ) {
    const where = {
      branchId,
      ...(params.status !== "ALL" ? { status: params.status as never } : {}),
      ...(params.q
        ? {
            OR: [
              {
                purchaseNumber: {
                  contains: params.q,
                  mode: "insensitive" as const,
                },
              },
              {
                supplier: {
                  name: { contains: params.q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.purchase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          supplier: { select: { supplierCode: true, name: true } },
          createdBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);
    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
  },
};
