"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/scheduled");
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center text-gray-500">
      Redirecting to Scheduled...
    </div>
  );
}