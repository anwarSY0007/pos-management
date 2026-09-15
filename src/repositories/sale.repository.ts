import "server-only";

import prisma from "@/lib/db";

const SALE_DETAIL_INCLUDE = {
  items: true,
  payments: true,
  customer: { select: { id: true, name: true } },
  cashier: { select: { name: true } },
  branch: { select: { code: true, name: true } },
} as const;

export const saleRepository = {
  findByRequestId(requestId: string) {
    return prisma.sale.findUnique({ where: { requestId } });
  },

  findById(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: SALE_DETAIL_INCLUDE,
    });
  },

  async list(
    branchId: string,
    params: { q?: string; page: number; pageSize: number },
  ) {
    const where = {
      branchId,
      ...(params.q
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: params.q,
                  mode: "insensitive" as const,
                },
              },
              {
                customer: {
                  name: { contains: params.q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          cashier: { select: { name: true } },
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.sale.count({ where }),
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
