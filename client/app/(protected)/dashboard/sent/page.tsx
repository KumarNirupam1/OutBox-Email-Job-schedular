"use client";

import { useSentEmails } from "@/features/emails/hooks/useEmail";
import { EmailTable } from "@/components/email/EmailTable";

export default function SentPage() {
  const { data: emails, isLoading, isError } = useSentEmails();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sent Emails</h2>
        <p className="text-sm text-gray-500">Track your delivered and failed emails.</p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <EmailTable 
          emails={emails || []} 
          isLoading={isLoading} 
          isError={isError} 
          type="sent" 
        />
      </div>
    </div>
  );
}