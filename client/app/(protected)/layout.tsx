import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-14 border-b bg-background" />}>
          <Header />
        </Suspense>
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}