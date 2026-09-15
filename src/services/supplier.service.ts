import "server-only";

import { ConflictError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { writeAudit, type AuditContext } from "@/lib/audit";
import { partyRepository } from "@/repositories/party.repository";
import { withTransaction } from "@/lib/db";
import type { CreateSupplierInput } from "@/schema/party.schema";

const MAX_CODE_RETRY = 3;

export const supplierService = {
  /** Kode immutable setelah dibuat — direferensikan dokumen & statement (D13). */
  async create(ctx: AuditContext, input: CreateSupplierInput) {
    for (let attempt = 1; attempt <= MAX_CODE_RETRY; attempt++) {
      try {
        return await withTransaction(async (tx) => {
          const n = await partyRepository.nextSupplierNumber(tx);
          const supplier = await tx.supplier.create({
            data: {
              supplierCode: `SUP-${String(n).padStart(4, "0")}`,
              name: input.name,
              phone: input.phone || null,
              email: input.email || null,
              address: input.address || null,
            },
          });
          await writeAudit(
            tx,
            ctx,
            "SUPPLIER_CREATE",
            "Supplier",
            supplier.id,
            null,
            supplier,
          );
          return supplier;
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_CODE_RETRY) continue; // race kode → retry
        if (isUniqueViolation(error))
          throw new ConflictError("Kode pemasok bentrok, coba lagi");
        throw error;
      }
    }
    throw new ConflictError("Kode pemasok bentrok, coba lagi");
  },

  async update(ctx: AuditContext, id: string, input: CreateSupplierInput) {
    return withTransaction(async (tx) => {
      const existing = await tx.supplier.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Pemasok");

      const supplier = await tx.supplier.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
        },
      });
      await writeAudit(
        tx,
        ctx,
        "SUPPLIER_UPDATE",
        "Supplier",
        id,
        existing,
        supplier,
      );
      return supplier;
    });
  },

  async setStatus(
    ctx: AuditContext,
    id: string,
    status: "ACTIVE" | "INACTIVE",
  ) {
    return withTransaction(async (tx) => {
      const existing = await tx.supplier.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Pemasok");

      const supplier = await tx.supplier.update({
        where: { id },
        data: { status },
      });
      await writeAudit(
        tx,
        ctx,
        status === "ACTIVE" ? "SUPPLIER_ACTIVATE" : "SUPPLIER_DEACTIVATE",
        "Supplier",
        id,
        { status: existing.status },
        { status },
      );
      return supplier;
    });
  },

  list: partyRepository.listSuppliers,
  findById: partyRepository.findSupplierById,
};

// hindari unused-import lint: prisma tidak dipakai langsung di file ini
// void prisma;
