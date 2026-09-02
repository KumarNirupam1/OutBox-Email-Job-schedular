"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailJob } from "@/lib/types";
import { format } from "date-fns";
import { Clock, Send, AlertCircle } from "lucide-react";

interface EmailTableProps {
  emails: EmailJob[];
  isLoading: boolean;
  isError: boolean;
  type: "scheduled" | "sent";
}

export function EmailTable({ emails, isLoading, isError, type }: EmailTableProps) {
  // 1. Loading State (Skeleton)
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  // 2. Error State
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-red-500">
        <AlertCircle className="mb-2 h-8 w-8" />
        <p className="font-medium">Failed to load emails.</p>
        <p className="text-sm text-gray-500">Please check your connection and try again.</p>
      </div>
    );
  }

  // 3. Empty State
  if (!emails || emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
        {type === "scheduled" ? (
          <Clock className="mb-4 h-12 w-12 text-gray-300" />
        ) : (
          <Send className="mb-4 h-12 w-12 text-gray-300" />
        )}
        <p className="text-lg font-medium">
          {type === "scheduled" ? "No scheduled emails" : "No sent emails yet"}
        </p>
        <p className="text-sm">
          {type === "scheduled" 
            ? 'Click "Compose" to schedule your first email.' 
            : "Your sent emails will appear here."}
        </p>
      </div>
    );
  }

  // 4. Data State
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipient</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>{type === "scheduled" ? "Scheduled Time" : "Sent Time"}</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {emails.map((email) => (
          <TableRow key={email.id} className="cursor-pointer hover:bg-gray-50">
            <TableCell className="font-medium">{email.recipientEmail}</TableCell>
            <TableCell className="max-w-[300px] truncate">{email.subject}</TableCell>
            <TableCell>
              {format(
                new Date(type === "scheduled" ? email.scheduledAt : email.sentAt || email.scheduledAt),
                "MMM dd, yyyy HH:mm"
              )}
            </TableCell>
            <TableCell className="text-right">
              <StatusBadge status={email.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Helper component for Status Badges
function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: "bg-orange-100 text-orange-800",
    SENT: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}