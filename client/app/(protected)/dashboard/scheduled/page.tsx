"use client";

import { useScheduledEmails } from "@/features/emails/hooks/useEmail";
import { EmailTable } from "@/components/email/EmailTable";

export default function ScheduledPage() {
  const { data: emails, isLoading, isError } = useScheduledEmails();

  return (
    <div className="-mx-3 md:-mx-6">
      <EmailTable
        emails={emails || []}
        isLoading={isLoading}
        isError={isError}
        type="scheduled"
      />
    </div>
  );
}