// features/emails/api/email.ts
import { EmailJob, SchedulePayload, Sender } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export interface EmailSearchResponse {
  query: string;
  status?: string[];
  count: number;
  results: EmailJob[];
}

async function fetchWithAuth(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
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
  getSent: () => 
    fetchWithAuth("/api/emails/sent") as Promise<EmailJob[]>,
  getById: (id: string) =>
    fetchWithAuth(`/api/emails/${encodeURIComponent(id)}`) as Promise<EmailJob>,
  schedule: (data: SchedulePayload) =>
    fetchWithAuth("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(data),
    }) as Promise<{ message: string; jobId: string }>,
  search: (query: string, status?: string) => {
    const params = new URLSearchParams({ q: query });
    if (status) {
      params.set("status", status);
    }
    return fetchWithAuth(`/api/emails/search?${params.toString()}`) as Promise<EmailSearchResponse>;
  },
  getSenders: () =>
    fetchWithAuth("/api/senders") as Promise<Sender[]>,
  ensureSender: () =>
    fetchWithAuth("/api/senders", { method: "POST" }) as Promise<Sender>,
};