"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useSearchEmails } from "@/features/emails/hooks/useEmail";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function getStatusFilter(pathname: string): string | undefined {
  if (pathname === "/dashboard/sent") {
    return "SENT,FAILED";
  }
  if (pathname === "/dashboard" || pathname === "/dashboard/scheduled") {
    return "PENDING";
  }
  return undefined;
}

function getRecipientName(email: string) {
  const localPart = email.split("@")[0] || email;
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character: string) => character.toUpperCase());
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Scheduled",
  SENT: "Sent",
  FAILED: "Failed",
};

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const statusFilter = getStatusFilter(pathname);

  const { data, isFetching } = useSearchEmails(debouncedQuery, statusFilter);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const results = (hasQuery && !isFetching ? data?.results : undefined) ?? [];
  const showDropdown = focused && hasQuery;
  const noResults = showDropdown && !isFetching && results.length === 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setFocused(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelect = (id: string) => {
    setFocused(false);
    router.push(`/dashboard/emails/${id}`);
  };

  const handleClear = () => {
    setQuery("");
    setFocused(true);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search emails..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setFocused(false);
          }
        }}
        className="h-9 w-full rounded-full border-gray-200 bg-muted/50 pl-9 pr-9 text-sm focus:bg-background focus-visible:ring-1 focus-visible:ring-primary"
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={handleClear}
          className="absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            {isFetching ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {isFetching
                ? "Searching..."
                : `${results.length} result${results.length === 1 ? "" : "s"}`}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
              {statusFilter ? statusFilter.replace(",", ", ") : "All"}
            </span>
          </div>

          {noResults && (
            <div className="flex items-center justify-center px-4 py-8 text-sm text-muted-foreground">
              No emails found
            </div>
          )}

          {results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto p-1">
              {results.map((email) => {
                const timestamp = email.scheduledAt;
                return (
                  <li key={email.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(email.id)}
                      className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {email.subject}
                        </span>
                        <Badge
                          variant={email.status === "FAILED" ? "destructive" : "secondary"}
                          className="shrink-0"
                        >
                          {STATUS_LABEL[email.status] ?? email.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          To: {getRecipientName(email.recipientEmail)}
                        </span>
                        <span
                          className={cn(
                            "ml-auto shrink-0",
                            email.status === "FAILED" && "text-destructive"
                          )}
                        >
                          {timestamp
                            ? format(new Date(timestamp), "MMM d, h:mm a")
                            : ""}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
