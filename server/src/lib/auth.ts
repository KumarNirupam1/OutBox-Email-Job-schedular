import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db.js";
import { backendUrl, frontendUrl, joinUrl } from "./url.js";

const isSecure = backendUrl.startsWith("https://");

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
	baseURL: backendUrl,
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
