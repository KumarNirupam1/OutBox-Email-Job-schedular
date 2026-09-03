export function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

export function joinUrl(base: string, path: string): string {
	const normalizedBase = stripTrailingSlash(base);
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${normalizedBase}${normalizedPath}`;
}

export const backendUrl = stripTrailingSlash(
	process.env.BACKEND_URL ?? "http://localhost:8080",
);

export const frontendUrl = stripTrailingSlash(
	process.env.FRONTEND_URL ??
		process.env.BETTER_AUTH_URL ??
		"http://localhost:3000",
);
