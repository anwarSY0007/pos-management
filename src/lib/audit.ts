import { Prisma } from "@/lib/generated/prisma/client";
import type { Tx } from "@/lib/db";

export type AuditContext = {
    userId: string;
    branchId?: string | null;
};

/**
 * Tulis audit log DI DALAM transaksi pemanggil (tx) —
 * ikut commit/rollback bersama aksi bisnisnya.
 * Decimal & Date aman via JSON.stringify (Decimal punya toJSON → string).
 */
export async function writeAudit(
    tx: Tx,
    ctx: AuditContext,
    action: string,
    entity: string,
    entityId: string | null,
    oldValue?: unknown,
    newValue?: unknown,
): Promise<void> {
    const serialize = (value: unknown): Prisma.InputJsonValue | undefined => {
        if (value === undefined || value === null) return undefined;
        return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    };

    await tx.auditLog.create({
        data: {
            userId: ctx.userId,
            branchId: ctx.branchId ?? null,
            action,
            entity,
            entityId,
            oldValue: serialize(oldValue),
            newValue: serialize(newValue),
        },
    });
}