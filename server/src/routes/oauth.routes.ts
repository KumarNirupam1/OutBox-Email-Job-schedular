import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { frontendUrl, joinUrl } from "../lib/url.js";

const router = Router();

function resolveCallbackUrl(requested: unknown): string {
	const fallback = joinUrl(frontendUrl, "/dashboard");
	if (typeof requested !== "string" || requested.length === 0) {
		return fallback;
	}

	try {
		if (new URL(requested).origin === new URL(frontendUrl).origin) {
			return requested;
		}
	} catch {
		return fallback;
	}

	return fallback;
}

/**
 * Top-level navigation start for Google OAuth so Set-Cookie is first-party
 * on the backend domain (not a third-party cookie from the Vercel origin).
 */
router.get("/google", async (req, res) => {
	const callbackURL = resolveCallbackUrl(req.query.callbackURL);
	const loginUrl = joinUrl(frontendUrl, "/login");

	try {
		const result = await auth.api.signInSocial({
			body: {
				provider: "google",
				callbackURL,
				newUserCallbackURL: callbackURL,
				errorCallbackURL: loginUrl,
			},
			headers: fromNodeHeaders(req.headers),
			returnHeaders: true,
		});

		const setCookies =
			typeof result.headers.getSetCookie === "function"
				? result.headers.getSetCookie()
				: [];
		for (const cookie of setCookies) {
			res.append("Set-Cookie", cookie);
		}

		if (result.response.url) {
			return res.redirect(result.response.url);
		}

		return res.status(500).json({ error: "Failed to start Google sign-in" });
	} catch (error) {
		console.error("Google OAuth start error:", error);
		return res.redirect(`${loginUrl}?error=oauth_start_failed`);
	}
});

export default router;
