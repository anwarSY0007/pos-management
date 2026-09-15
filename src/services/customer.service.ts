import "server-only";

import { ConflictError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { writeAudit, type AuditContext } from "@/lib/audit";
import { toMoney } from "@/lib/utils/money";
import { partyRepository } from "@/repositories/party.repository";
import { withTransaction } from "@/lib/db";
import type { CreateCustomerInput } from "@/schema/party.schema";

const MAX_CODE_RETRY = 3;

export const customerService = {
  /** Kode immutable setelah dibuat — direferensikan dokumen & statement (D13). */
  async create(ctx: AuditContext, input: CreateCustomerInput) {
    for (let attempt = 1; attempt <= MAX_CODE_RETRY; attempt++) {
      try {
        return await withTransaction(async (tx) => {
          const n = await partyRepository.nextCustomerNumber(tx);
          const customer = await tx.customer.create({
            data: {
              customerCode: `CUS-${String(n).padStart(4, "0")}`,
              name: input.name,
              phone: input.phone || null,
              email: input.email || null,
              address: input.address || null,
              creditLimit: toMoney(input.creditLimit ?? "0"),
            },
          });
          await writeAudit(
            tx,
            ctx,
            "CUSTOMER_CREATE",
            "Customer",
            customer.id,
            null,
            customer,
          );
          return customer;
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_CODE_RETRY) continue; // race kode → retry
        if (isUniqueViolation(error))
          throw new ConflictError("Kode pelanggan bentrok, coba lagi");
        throw error;
      }
    }
    throw new ConflictError("Kode pelanggan bentrok, coba lagi");
  },

  async update(ctx: AuditContext, id: string, input: CreateCustomerInput) {
    return withTransaction(async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Pelanggan");

      const customer = await tx.customer.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          creditLimit: toMoney(input.creditLimit ?? "0"),
        },
      });
      await writeAudit(
        tx,
        ctx,
        "CUSTOMER_UPDATE",
        "Customer",
        id,
        existing,
        customer,
      );
      return customer;
    });
  },

  async setStatus(
    ctx: AuditContext,
    id: string,
    status: "ACTIVE" | "INACTIVE",
  ) {
    return withTransaction(async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Pelanggan");

      const customer = await tx.customer.update({
        where: { id },
        data: { status },
      });
      await writeAudit(
        tx,
        ctx,
        status === "ACTIVE" ? "CUSTOMER_ACTIVATE" : "CUSTOMER_DEACTIVATE",
        "Customer",
        id,
        { status: existing.status },
        { status },
      );
      return customer;
    });
  },

  list: partyRepository.listCustomers,
  findById: partyRepository.findCustomerById,
};

// hindari unused-import lint: prisma tidak dipakai langsung di file ini
// void prisma;
