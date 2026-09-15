"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db";
import {
    ACTIVE_BRANCH_COOKIE,
    assertBranchMembership,
    getSessionContext,
} from "@/lib/permissions/authorize";
import { NotFoundError, toActionResponse } from "@/lib/errors";

const BranchIdSchema = z.uuid();

export async function switchBranch(
    input: string,
): Promise<{ success: true } | { success: false; error: string; code: string }> {
    try {
        const parsed = BranchIdSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "ID cabang tidak valid", code: "VALIDATION_ERROR" };
        }

        const ctx = await getSessionContext();

        if (ctx.isSuperAdmin) {
            const branch = await prisma.branch.findUnique({
                where: { id: parsed.data },
                select: { id: true },
            });
            if (!branch) throw new NotFoundError("Cabang");
        } else {
            await assertBranchMembership(ctx.userId, parsed.data);
        }

        (await cookies()).set(ACTIVE_BRANCH_COOKIE, parsed.data, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });

        revalidatePath("/", "layout");
        return { success: true };
    } catch (error) {
        return toActionResponse(error);
    }
}