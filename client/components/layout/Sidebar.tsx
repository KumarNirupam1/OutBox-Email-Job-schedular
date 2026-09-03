// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Send, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/features/auth/lib/auth-client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useScheduledEmails, useSentEmails } from "@/features/emails/hooks/useEmail";

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const { data: scheduledEmails } = useScheduledEmails();
  const { data: sentEmails } = useSentEmails();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await authClient.getSession();
      if (data?.user) setUser(data.user);
    };
    checkAuth();
  }, []);

  const navItems = [
    { 
      href: "/dashboard/scheduled", 
      label: "Scheduled", 
      icon: Clock,
      count: scheduledEmails?.length || 0
    },
    { 
      href: "/dashboard/sent", 
      label: "Sent", 
      icon: Send,
      count: sentEmails?.length || 0
    },
  ];

  return (
    <aside className="flex min-h-screen w-56 shrink-0 flex-col border-r bg-sidebar p-4 text-sidebar-foreground">
      {/* Logo */}
      <div className="mb-6 px-2">
        <h1 className="text-2xl font-bold tracking-tighter text-primary">OutBox</h1>
      </div>

      {/* User Profile */}
      {user && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={user.image || ""} alt={user.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {user.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start overflow-hidden">
            <span className="w-full truncate text-sm font-medium">{user.name}</span>
            <span className="w-full truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
      )}

      {/* Compose Button */}
      <Link href="/dashboard/compose" className="mb-6">
        <Button 
          variant="default" 
          className="h-9 w-full rounded-full bg-primary text-xs text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Compose
        </Button>
      </Link>

      {/* Navigation */}
      <div className="flex-1">
        <p className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
          Core
        </p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200/50"
                    : "text-sidebar-foreground hover:bg-muted/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn(
                    "h-4 w-4",
                    isActive && "text-green-600"
                  )} />
                  {item.label}
                </div>
                {item.count > 0 && (
                  <span className={cn(
                    "text-xs font-medium",
                    isActive ? "text-green-600" : "text-muted-foreground"
                  )}>
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}