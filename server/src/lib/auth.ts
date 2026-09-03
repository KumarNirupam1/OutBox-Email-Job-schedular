import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db.js";
import { backendUrl, frontendUrl, joinUrl } from "./url.js";

// The auth flow is served through the frontend origin (the Next.js app proxies
// `/api/*` to this backend). Setting better-auth's baseURL to the frontend
// makes the Google OAuth redirect URI and callback resolve on the app origin,
// so the session cookie is issued there as a first-party cookie — required for
// login/avatar to work in every browser (including incognito, where third-party
// cookies are blocked).
const isSecure = frontendUrl.startsWith("https://");

/**
 * Cross-site cookie attrs for a split Vercel frontend + Render backend.
 * In better-auth 1.7.2 these are applied to every cookie created via
 * createCookieGetter — including `__Secure-better-auth.state`.
 */
const crossSiteCookieAttributes = {
	secure: isSecure,
	sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
	path: "/",
	httpOnly: true,
};

export const auth = betterAuth({
	baseURL: process.env.AUTH_BASE_URL ?? frontendUrl,
	secret: process.env.BETTER_AUTH_SECRET!,
	trustedOrigins: [frontendUrl, backendUrl],
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	account: {
		storeStateStrategy: "database",

		skipStateCookieCheck: true,
	},
	advanced: {
		disableOriginCheck: true,
		useSecureCookies: isSecure,
		defaultCookieAttributes: crossSiteCookieAttributes,
		cookies: {
			state: { attributes: crossSiteCookieAttributes },
			oauth_state: { attributes: crossSiteCookieAttributes },
			session_token: { attributes: crossSiteCookieAttributes },
		},
	},
	onAPIError: {
		errorURL: joinUrl(frontendUrl, "/login"),
	},
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
	},
});
