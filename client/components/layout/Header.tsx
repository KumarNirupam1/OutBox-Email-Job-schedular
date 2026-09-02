"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Link } from "lucide-react";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { ModeToggle } from "../ui/mode-toggle";

async function getSlackStatus() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  const response = await fetch(`${backendUrl}/api/slack/status`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Link status");
  }

  return (await response.json()) as {
    connected: boolean;
    channelName?: string;
    teamName?: string;
  };
}

export function Header() {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("slack") === "connected";

  const { data: slackStatus, isLoading } = useQuery({
    queryKey: ["slack-status"],
    queryFn: getSlackStatus,
    retry: false,
    staleTime: 30_000,
  });

  const isSlackConnected = slackStatus?.connected || justConnected;

  const handleConnectSlack = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    window.open(`${backendUrl}/api/slack/connect`, "_self");
  };

  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-3 text-foreground">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search emails..."
          className="border-input bg-muted pl-9 focus:bg-background focus-visible:ring-1 focus-visible:ring-green-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <SignOutButton />
        <ModeToggle />

        <Button
          variant="outline"
          size="sm"
          onClick={handleConnectSlack}
          disabled={isLoading || isSlackConnected}
          className={isSlackConnected
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"}
        >
          <Link className="mr-2 h-4 w-4" />
          {isSlackConnected ? "Slack Connected" : "Connect Slack"}
        </Button>
      </div>
    </header>
  );
}