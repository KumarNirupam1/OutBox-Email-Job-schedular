"use client";

import { useSentEmails } from "@/features/emails/hooks/useEmail";
import { EmailTable } from "@/components/email/EmailTable";

export default function SentPage() {
  const { data: emails, isLoading, isError } = useSentEmails();

  return (
    <div className="-mx-3 md:-mx-6">
      <EmailTable
        emails={emails || []}
        isLoading={isLoading}
        isError={isError}
        type="sent"
      />
    </div>
  );
}