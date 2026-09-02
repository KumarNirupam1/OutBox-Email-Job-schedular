"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Send, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/features/auth/lib/auth-client";
import { useEffect, useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await authClient.getSession();
      if (data?.user) setUser(data.user);
    };
    checkAuth();
  }, []);

  const navItems = [
    { href: "/dashboard/scheduled", label: "Scheduled", icon: Clock },
    { href: "/dashboard/sent", label: "Sent", icon: Send },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white p-4">
      {/* Logo */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tighter text-black">ONB</h1>
      </div>

      {/* User Profile */}
      {user && (
        <div className="flex items-center gap-3 rounded-lg p-2 mb-4">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || ""} alt={user.name} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start overflow-hidden">
            <span className="text-sm font-medium text-gray-900 truncate w-full">{user.name}</span>
            <span className="text-xs text-gray-500 truncate w-full">{user.email}</span>
          </div>
        </div>
      )}

      {/* Compose Button */}
      <Link href="/dashboard/compose" className="mb-6">
        <Button variant="outline" className="w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700">
          <Plus className="mr-2 h-4 w-4" />
          Compose
        </Button>
      </Link>

      {/* Navigation */}
      <div>
        <p className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">Core</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}