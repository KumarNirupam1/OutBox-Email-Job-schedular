import { createAuthClient } from "better-auth/react";

export function clearAuthState() {
	if (typeof document === "undefined") {
		return;
	}

	document.cookie.split(";").forEach((cookie) => {
		const eq = cookie.indexOf("=");
		const name = eq > -1 ? cookie.slice(0, eq).trim() : cookie.trim();

		if (!name) {
			return;
		}

		if (
			name.startsWith("better-auth") ||
			name.startsWith("auth") ||
			name.includes("session") ||
			name.includes("oauth") ||
			name.includes("state")
		) {
			document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
		}
	});

	try {
		sessionStorage.clear();
		localStorage.clear();
	} catch {
		// ignore storage access issues in restricted environments
	}
}

export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
