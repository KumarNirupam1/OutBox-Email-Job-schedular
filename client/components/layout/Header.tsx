"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Link as LinkIcon, RefreshCw, Filter } from "lucide-react";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { cn } from "@/lib/utils";
import { useState } from "react";

async function getSlackStatus() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  const response = await fetch(`${backendUrl}/api/slack/status`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Slack status");
  }

  return (await response.json()) as {
    connected: boolean;
    channelName?: string;
    teamName?: string;
  };
}

export function Header() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const justConnected = searchParams.get("slack") === "connected";

  const { data: slackStatus, isLoading, refetch } = useQuery({
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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["emails", "scheduled"] });
    queryClient.invalidateQueries({ queryKey: ["emails", "sent"] });
    refetch();
  };

  return (
    <header className="flex min-h-14 items-center justify-between gap-4 border-b bg-background px-4 py-3 text-foreground md:px-6">
      {/* Left side - empty */}
      <div className="w-32"></div>

      {/* Center - Search with Filter and Refresh */}
      <div className="flex flex-1 items-center justify-center gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-full border-gray-200 bg-muted/50 pl-9 pr-4 text-sm focus:bg-background focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-muted/50 p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <SignOutButton />

        <Button
          variant="outline"
          size="sm"
          onClick={handleConnectSlack}
          disabled={isLoading || isSlackConnected}
          className={cn(
            "h-9 gap-2",
            isSlackConnected
              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
          )}
        >
          <LinkIcon className="h-4 w-4" />
          {isSlackConnected ? "Slack Connected" : "Connect Slack"}
        </Button>
      </div>
    </header>
  );
}