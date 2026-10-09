"use client";

import { Navbar } from "@/components/Navbar";
import { RequireAuth } from "@/components/RequireAuth";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Navbar />
      {children}
    </RequireAuth>
  );
}
