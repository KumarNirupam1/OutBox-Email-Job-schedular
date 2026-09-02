export interface Sender {
  id: string;
  email: string;
}

export interface EmailJob {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "PENDING" | "SENT" | "FAILED";
  scheduledAt: string;
  sentAt?: string | null;
  errorMessage?: string | null;
  sender: Sender;
}

export interface SchedulePayload {
  recipientEmail: string;
  subject: string;
  body: string;
  senderId: string;
  scheduledAt: string;
}