import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { AUTH_ROUTES, DEFAULT_REDIRECT, PROTECTED_ROUTES } from "@/config/auth"

/**
 * Proxy for optimistic route protection (Next.js 16+).
 *
 * IMPORTANT: This is for UX optimization only, NOT security.
 * Cookie checks can be bypassed - authorization is enforced per-page
 * via requirePermission() and per-action via authorize().
 */

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (
        pathname.startsWith("/api") ||
        pathname.startsWith("/_next") ||
        pathname.includes(".")
    ) {
        return NextResponse.next()
    }

    const sessionCookie = getSessionCookie(request)
    const isAuthenticated = !!sessionCookie

    const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
        pathname.startsWith(route)
    )

    if (isProtectedRoute && !isAuthenticated) {
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("callbackUrl", pathname)
        return NextResponse.redirect(loginUrl)
    }

    const isAuthRoute = AUTH_ROUTES.some((route) =>
        pathname.startsWith(route)
    )

    if (isAuthRoute && isAuthenticated) {
        return NextResponse.redirect(new URL(DEFAULT_REDIRECT, request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)",
    ],
}