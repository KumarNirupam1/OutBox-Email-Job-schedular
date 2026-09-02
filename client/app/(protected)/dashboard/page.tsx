"use client";

import { useScheduledEmails } from "@/features/emails/hooks/useEmail";
import { EmailTable } from "@/components/email/EmailTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: emails, isLoading, isError } = useScheduledEmails();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Overview of your email campaigns.
          </p>
        </div>
        <Link href="/dashboard/compose">
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="mr-2 h-4 w-4" />
            Compose New Email
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <EmailTable
          emails={emails?.slice(0, 10) || []}
          isLoading={isLoading}
          isError={isError}
          type="scheduled"
        />
      </div>
    </div>
  );
}