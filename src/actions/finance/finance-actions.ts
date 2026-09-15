"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse } from "@/lib/errors";
import { parseOrThrow } from "@/lib/utils/parse-or-throw";
import { cashService } from "@/services/cash.service";
import { expenseService } from "@/services/expense.service";
import { financeService } from "@/services/finance.service";
import {
  createCashAccountSchema,
  transferCashSchema,
  adjustCashSchema,
  createExpenseSchema,
  payReceivableSchema,
  payPayableSchema,
} from "@/schema/finance.schema";

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/finance/cash");
  revalidatePath("/finance/expenses");
  revalidatePath("/finance/receivables");
  revalidatePath("/finance/payables");
  revalidatePath("/accounting/journal");
}

export async function createCashAccount(
  input: unknown,
): Promise<ActionResponse<{ id: string }>> {
  try {
    const data = parseOrThrow(createCashAccountSchema, input);
    const ctx = await authorize("cash.manage");
    const acc = await cashService.createAccount(ctx, data);
    revalidateFinance();
    return { success: true, data: { id: acc.id } };
  } catch (e) {
    return toActionResponse(e);
  }
}

export async function transferCash(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(transferCashSchema, input);
    const ctx = await authorize("cash.manage");
    await cashService.transfer(ctx, data);
    revalidateFinance();
    return { success: true, data: null };
  } catch (e) {
    return toActionResponse(e);
  }
}

export async function adjustCash(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(adjustCashSchema, input);
    const ctx = await authorize("cash.manage");
    await cashService.adjust(ctx, data);
    revalidateFinance();
    return { success: true, data: null };
  } catch (e) {
    return toActionResponse(e);
  }
}

export async function createExpense(
  input: unknown,
): Promise<ActionResponse<{ id: string }>> {
  try {
    const data = parseOrThrow(createExpenseSchema, input);
    const ctx = await authorize("expense.create");
    const exp = await expenseService.create(ctx, data);
    revalidateFinance();
    return { success: true, data: { id: exp.id } };
  } catch (e) {
    return toActionResponse(e);
  }
}

export async function payReceivable(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(payReceivableSchema, input);
    const ctx = await authorize("receivable.payment");
    await financeService.payReceivable(ctx, data);
    revalidateFinance();
    return { success: true, data: null };
  } catch (e) {
    return toActionResponse(e);
  }
}

export async function payPayable(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(payPayableSchema, input);
    const ctx = await authorize("payable.payment");
    await financeService.payPayable(ctx, data);
    revalidateFinance();
    return { success: true, data: null };
  } catch (e) {
    return toActionResponse(e);
  }
}
