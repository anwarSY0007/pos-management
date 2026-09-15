import type { Role } from "@/types/auth"

/**
 * Centralized auth configuration.
 * Role-based per-prefix redirect dihapus: semua role menuju dashboard yang sama,
 * authorization halus dilakukan per-halaman via requirePermission().
 */

export const ROLE_REDIRECTS: Record<Role, string> = {
    SUPER_ADMIN: "/dashboard",
    OWNER: "/dashboard",
    ADMIN: "/dashboard",
    CASHIER: "/dashboard",
    WAREHOUSE: "/dashboard",
} as const

export const DEFAULT_REDIRECT = "/dashboard"

// Auth routes (public, redirect away if authenticated)
export const AUTH_ROUTES = [
    "/login",
    "/register",
] as const

// Protected routes (require authentication — optimistic, proxy only)
export const PROTECTED_ROUTES = [
    "/dashboard",
    "/settings",
    "/profile",
    "/pos",
    "/products",
    "/inventory",
    "/categories",
    "/sales",
    "/purchases",
    "/customers",
    "/suppliers",
    "/finance",
    "/accounting",
    "/reports",
    "/users",
    "/roles",
    "/branches",
] as const

export function getRoleRedirect(role: Role | undefined): string {
    if (!role) return "/login"
    return ROLE_REDIRECTS[role] ?? DEFAULT_REDIRECT
}

export function isAuthRoute(pathname: string): boolean {
    return AUTH_ROUTES.some(route => pathname.startsWith(route))
}

export function isProtectedRoute(pathname: string): boolean {
    return PROTECTED_ROUTES.some(route => pathname.startsWith(route))
}