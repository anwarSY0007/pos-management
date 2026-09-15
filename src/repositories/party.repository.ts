import "server-only";

import prisma from "@/lib/db";
import type { Tx } from "@/lib/db";
import type { PartyListParams } from "@/schema/party.schema";

async function nextCustomerNumber(tx: Tx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ next: bigint }>>`
        SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE("customerCode", '[^0-9]', '', 'g'), '')::BIGINT), 0) + 1 AS next
        FROM "customer"`;
  return Number(rows[0]?.next ?? 1);
}

async function nextSupplierNumber(tx: Tx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ next: bigint }>>`
        SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE("supplierCode", '[^0-9]', '', 'g'), '')::BIGINT), 0) + 1 AS next
        FROM "supplier"`;
  return Number(rows[0]?.next ?? 1);
}

const partyWhere = (params: PartyListParams, fields: Record<string, true>) => ({
  status: params.status === "ALL" ? undefined : params.status,
  ...(params.q
    ? {
        OR: Object.keys(fields).map((f) => ({
          [f]: { contains: params.q, mode: "insensitive" as const },
        })),
      }
    : {}),
});

export const partyRepository = {
  nextCustomerNumber,
  nextSupplierNumber,

  async listCustomers(params: PartyListParams) {
    const where = partyWhere(params, {
      name: true,
      customerCode: true,
      phone: true,
    });
    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.customer.count({ where }),
    ]);
    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
  },

  async listSuppliers(params: PartyListParams) {
    const where = partyWhere(params, {
      name: true,
      supplierCode: true,
      phone: true,
    });
    const [items, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.supplier.count({ where }),
    ]);
    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
  },

  findCustomerById: (id: string) =>
    prisma.customer.findUnique({ where: { id } }),
  findSupplierById: (id: string) =>
    prisma.supplier.findUnique({ where: { id } }),
};
