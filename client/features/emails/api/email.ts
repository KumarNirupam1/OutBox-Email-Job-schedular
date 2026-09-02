import { EmailJob, SchedulePayload } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

async function fetchWithAuth(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include", // CRITICAL: Sends Better Auth cookies
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "API Error" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const emailApi = {
  getScheduled: () =>
    fetchWithAuth("/api/emails/scheduled") as Promise<EmailJob[]>,
  getSent: () => fetchWithAuth("/api/emails/sent") as Promise<EmailJob[]>,
  schedule: (data: SchedulePayload) =>
    fetchWithAuth("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(data),
    }) as Promise<{ message: string; jobId: string }>,
};