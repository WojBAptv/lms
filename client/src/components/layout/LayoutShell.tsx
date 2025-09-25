import type { PropsWithChildren } from "react";
import { AppNav } from "./AppNav";
import { ThemeToggle } from "./ThemeToggle";
import { Toaster } from "@/components/ui/sonner";

export function LayoutShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen grid grid-cols-[auto,1fr]">
      <AppNav />
      <div className="flex flex-col h-screen">
        <header className="h-14 flex items-center justify-between px-4 border-b border-black/10 dark:border-white/10">
          <div className="font-semibold">Lab Management System</div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">{children}</main>
        <Toaster />
      </div>
    </div>
  );
}
