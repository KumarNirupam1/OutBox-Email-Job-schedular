import { headers } from "next/headers";
import { authClient } from "./auth-client";

export type Session = typeof authClient.$Infer.Session;

function getBackendUrl(): string {
    return (
        process.env.API_PROXY_TARGET ??
        process.env.NEXT_PUBLIC_BACKEND_URL ??
        "http://localhost:8080"
    ).replace(/\/+$/, "");
}

export async function getSession(): Promise<Session | null> {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie") ?? "";

    try {
        const response = await fetch(
            `${getBackendUrl()}/api/auth/get-session`,
            {
                headers: { cookie },
                cache: "no-store",
            },
        );

        if (!response.ok) {
            return null;
        }

        const data = (await response.json()) as Session | null;
        return data?.user ? data : null;
    } catch {
        return null;
    }
}
