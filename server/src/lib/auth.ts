import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db.js";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";
const frontendUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
	baseURL: backendUrl,
	secret: process.env.BETTER_AUTH_SECRET!,
	trustedOrigins: [frontendUrl, backendUrl],
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
	},
});
