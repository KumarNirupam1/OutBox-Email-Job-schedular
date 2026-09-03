export function getBackendUrl(): string {
	return (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080").replace(
		/\/+$/,
		"",
	);
}

export function backendApi(path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${getBackendUrl()}${normalizedPath}`;
}
