"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (getSession()) {
      setAllowed(true);
      return;
    }
    router.replace("/");
  }, [router]);

  if (!allowed) {
    return (
      <main className="login-page">
        <div className="empty">Checking session…</div>
      </main>
    );
  }

  return <>{children}</>;
}
