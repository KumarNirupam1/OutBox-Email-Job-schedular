import { NextRequest, NextResponse } from "next/server";
import {
    authRoutes,
    isProtectedRoute,
    isUnauthenticatedRoute,
} from "@/features/auth";

function getBackendUrl(): string {
    return (
        process.env.API_PROXY_TARGET ??
        process.env.NEXT_PUBLIC_BACKEND_URL ??
        "http://localhost:8080"
    ).replace(/\/+$/, "");
}

async function fetchSession(request: NextRequest) {
    try {
        const response = await fetch(
            `${getBackendUrl()}/api/auth/get-session`,
            {
                headers: {
                    cookie: request.headers.get("cookie") ?? "",
                },
                cache: "no-store",
            },
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data?.user ? data : null;
    } catch {
        return null;
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const session = await fetchSession(request);

    if (isProtectedRoute(pathname) && !session) {
        const loginUrl = new URL(authRoutes.login, request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (isUnauthenticatedRoute(pathname) && session) {
        return NextResponse.redirect(new URL(authRoutes.dashboard, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/workspace/:path*", "/login"],
};
