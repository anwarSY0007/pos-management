"use server";

import { SignInSchema, SignUpUserSchema } from "@/schema";
import type { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import prisma from "@/lib/db";
import type { ActionResponse } from "@/types/api";
import {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
} from "@/lib/auth-rate-limit";
import { getRoleRedirect } from "@/config/auth";
import type { Role } from "@/types/auth";

export async function signIn(
  values: z.infer<typeof SignInSchema>,
): Promise<ActionResponse<never>> {
  const validatedFields = SignInSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      success: false,
      error: "Invalid email or password format",
    };
  }

  const { email, password } = validatedFields.data;

  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = checkRateLimit({
    key: "sign-in",
    identifier: clientIP,
    ...RATE_LIMITS.signIn,
  });

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: `Too many sign-in attempts. Please try again in ${rateLimitResult.retryAfterSeconds} seconds.`,
    };
  }

  try {
    const res = await auth.api.signInEmail({
      body: { email, password },
      headers: headersList,
    });

    if (!res.user) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    const userWithRole = await prisma.user.findUnique({
      where: { id: res.user.id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!userWithRole) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const redirectPath = getRoleRedirect(userWithRole.role as Role);
    redirect(redirectPath);
  } catch (error) {
    // Rethrow Next.js internal control-flow errors (redirect, notFound, dll)
    // via API publik, bukan menebak path internal next/dist yang bisa berubah.
    unstable_rethrow(error);

    console.error("Sign in error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An error occurred during sign in",
    };
  }
}

export async function signUpUser(
  values: z.infer<typeof SignUpUserSchema>,
): Promise<ActionResponse<{ userId: string }>> {
  const validatedFields = SignUpUserSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      success: false,
      error: "Invalid input. Please check your details",
    };
  }

  const { name, email, password } = validatedFields.data;

  const headersList = await headers();
  const clientIP = getClientIP(headersList);
  const rateLimitResult = checkRateLimit({
    key: "sign-up",
    identifier: clientIP,
    ...RATE_LIMITS.signUp,
  });

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: `Too many sign-up attempts. Please try again in ${rateLimitResult.retryAfterSeconds} seconds.`,
    };
  }

  try {
    const res = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: headersList,
    });

    if (!res.user) {
      return {
        success: false,
        error: "Failed to create account",
      };
    }

    // Role default = CASHIER (via additionalFields defaultValue di lib/auth.ts).
    // Tanpa branch → belum bisa akses data apapun sampai di-assign OWNER/SUPER_ADMIN.
    return {
      success: true,
      data: { userId: res.user.id },
    };
  } catch (error) {
    unstable_rethrow(error);

    console.error("Sign up error:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("already exists") ||
        error.message.includes("duplicate")
      ) {
        return {
          success: false,
          error: "An account with this email already exists",
        };
      }
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create account",
    };
  }
}
