"use client";

import type { EmailJob } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

interface EmailTableProps {
  emails: EmailJob[];
  isLoading: boolean;
  isError: boolean;
  type: "scheduled" | "sent";
}

function getRecipientName(email: string) {
  const localPart = email.split("@")[0] || email;

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function EmailTable({ emails, isLoading, isError, type }: EmailTableProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center px-4 py-3 text-sm text-muted-foreground">
        Loading emails...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center px-4 py-3 text-sm text-destructive">
        Failed to load emails
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center px-4 py-3 text-sm text-muted-foreground">
        No emails found
      </div>
    );
  }

  return (
    <div className="space-y-1 divide-y divide-gray-100">
      {emails.map((email) => {
        const bodyPreview = email.body?.trim() || "No preview available";
        const preview = bodyPreview.length > 100
          ? `${bodyPreview.slice(0, 100)}...`
          : bodyPreview;
        const isScheduled = type === "scheduled";
        const timestamp = isScheduled
          ? format(new Date(email.scheduledAt), "MMM dd, yyyy HH:mm")
          : null;

        return (
          <Link
            key={email.id}
            href={`/dashboard/emails/${email.id}`}
            className="flex min-w-0 items-center gap-4 px-4 py-3 transition-colors hover:bg-green-50/50"
          >
            <div className="flex w-44 shrink-0 items-baseline gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                To: {getRecipientName(email.recipientEmail)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                    isScheduled
                      ? "bg-amber-50 text-amber-700 ring-amber-200/50"
                      : "bg-green-50 text-green-700 ring-green-200/50"
                  )}
                >
                  {isScheduled ? timestamp : "Sent"}
                </span>
                <span className="min-w-0 truncate text-sm text-gray-700">
                  <span className="font-medium">{email.subject}</span>
                  <span className="text-gray-400"> - {preview}</span>
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}