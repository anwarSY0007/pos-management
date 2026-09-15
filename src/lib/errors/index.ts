import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Typed error model.
 * Semua Server Action POS menangkap error → toActionResponse(error).
 * Detail teknis (stack, SQL) HANYA ke server log, tidak pernah ke client.
 */

export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public status: number = 400,
        public details?: unknown,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export class ValidationError extends AppError {
    constructor(message = "Data tidak valid", details?: unknown) {
        super("VALIDATION_ERROR", message, 422, details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Silakan login terlebih dahulu") {
        super("UNAUTHORIZED", message, 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(permission?: string) {
        super(
            "FORBIDDEN",
            permission ? `Akses ditolak: butuh permission "${permission}"` : "Akses ditolak",
            403,
        );
    }
}

export class NotFoundError extends AppError {
    constructor(entity = "Data") {
        super("NOT_FOUND", `${entity} tidak ditemukan`, 404);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Data sudah ada") {
        super("CONFLICT", message, 409);
    }
}

export class BusinessRuleError extends AppError {
    constructor(code: string, message: string, details?: unknown) {
        super(code, message, 422, details);
    }
}

export type ActionFailure = {
    success: false;
    error: string;
    code: string;
};

export function isUniqueViolation(error: unknown, field?: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== "P2002") return false;
    if (!field) return true;
    const meta = error.meta as { target?: unknown } | undefined;
    const targets = Array.isArray(meta?.target) ? (meta.target as string[]) : [];
    return targets.length === 0 ? true : targets.includes(field);
}

/**
 * Mapper standar catch di Server Action.
 * Shape kompatibel dengan ActionResponse starter kit (field `code` opsional aditif).
 */
export function toActionResponse(error: unknown): ActionFailure {
    if (error instanceof AppError) {
        return { success: false, error: error.message, code: error.code };
    }
    if (isUniqueViolation(error)) {
        return { success: false, error: "Data sudah ada", code: "CONFLICT" };
    }
    // Full detail hanya di server log
    console.error("[action-error]", error);
    return { success: false, error: "Terjadi kesalahan. Coba lagi.", code: "INTERNAL" };
}

export function toHttpStatus(error: unknown): number {
    if (error instanceof AppError) return error.status;
    return 500;
}