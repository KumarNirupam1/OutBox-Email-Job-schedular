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
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  name: string;
  type?: string;
  size?: number;
  url?: string;
}

export interface EmailAttachmentPayload {
  name: string;
  type: string;
  size: number;
  base64: string;
}

export interface SchedulePayload {
  recipientEmail: string;
  subject: string;
  body: string;
  senderId: string;
  scheduledAt: string;
  delayBetween?: number;  
  hourlyLimit?: number;
  attachments?: EmailAttachmentPayload[];
}