import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerSession } from "@/lib/auth-server";
import prisma from "@/lib/db";
import { hasPermission, type Permission } from "@/config/permissions";
import type { Role } from "@/types/auth";
import { BusinessRuleError, ForbiddenError, UnauthorizedError } from "@/lib/errors";

export const ACTIVE_BRANCH_COOKIE = "pos_branch_id";

export type SessionContext = {
    userId: string;
    name: string;
    email: string;
    role: Role;
    isSuperAdmin: boolean;
    activeBranchId: string | null;
};

export type AuthorizedContext = SessionContext & { branchId: string };

/**
 * Context request saat ini. cache() = dedupe per request
 * (session cookie + branch cookie dibaca sekali per render/request).
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
    const session = await getServerSession();
    if (!session) throw new UnauthorizedError();

    const role = session.user.role as Role;
    const jar = await cookies();

    return {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role,
        isSuperAdmin: role === "SUPER_ADMIN",
        activeBranchId: jar.get(ACTIVE_BRANCH_COOKIE)?.value ?? null,
    };
});

/**
 * Cek keanggotaan branch. SUPER_ADMIN bypass (akses semua branch).
 */
export const assertBranchMembership = cache(
    async (userId: string, branchId: string): Promise<void> => {
        const count = await prisma.userBranch.count({
            where: { userId, branchId },
        });
        if (count === 0) throw new ForbiddenError("branch.access");
    },
);

/**
 * Gate WAJIB untuk semua Server Action POS.
 * Mengembalikan context + branchId TERVERIFIKASI (membership di server),
 * BUKAN branchId mentah dari client.
 */
export async function authorize(
    permission: Permission,
    opts?: { branchId?: string },
): Promise<AuthorizedContext> {
    const ctx = await getSessionContext();

    if (!hasPermission(ctx.role, permission)) {
        throw new ForbiddenError(permission);
    }

    const branchId = opts?.branchId ?? ctx.activeBranchId;
    if (!branchId) {
        throw new BusinessRuleError("NO_ACTIVE_BRANCH", "Pilih cabang terlebih dahulu.");
    }

    if (!ctx.isSuperAdmin) {
        await assertBranchMembership(ctx.userId, branchId);
    }

    return { ...ctx, branchId };
}

/**
 * Untuk Server Components: redirect (bukan throw).
 * branchId boleh null → halaman menampilkan branch picker.
 */
export async function requirePermission(
  permission: Permission,
): Promise<AuthorizedContext | null> {
  const ctx = await getSessionContext().catch(() => null);
  if (!ctx) redirect("/login");
  if (!hasPermission(ctx.role, permission)) redirect("/dashboard");

  const branchId = ctx.activeBranchId;
  if (branchId && !ctx.isSuperAdmin) {
    try {
      await assertBranchMembership(ctx.userId, branchId);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        // branch di cookie sudah tidak valid buat user ini
        return null;
      }
      throw err;
    }
  }

  return branchId ? { ...ctx, branchId } : null;
}

/**
 * Daftar branch yang boleh diakses user (untuk BranchSwitcher).
 */
export async function listAccessibleBranches(ctx: SessionContext) {
    if (ctx.isSuperAdmin) {
        return prisma.branch.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, code: true, name: true },
        });
    }

    const rows = await prisma.userBranch.findMany({
        where: { userId: ctx.userId, branch: { isActive: true } },
        orderBy: [{ isDefault: "desc" }, { branch: { name: "asc" } }],
        select: {
            branch: { select: { id: true, code: true, name: true } },
        },
    });

    return rows.map((r) => r.branch);
}