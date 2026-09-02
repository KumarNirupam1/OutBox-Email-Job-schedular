"use client";

import { ComposeForm } from "@/components/email/ComposeForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ComposePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/scheduled">
          <ArrowLeft className="h-5 w-5 text-gray-500 hover:text-gray-900" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Compose Campaign</h2>
      </div>

      <ComposeForm />
    </div>
  );
}