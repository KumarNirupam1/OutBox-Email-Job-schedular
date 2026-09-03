"use client";

import { ComposeForm } from "@/components/email/ComposeForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ComposePage() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
      </div>

      <ComposeForm />
    </div>
  );
}