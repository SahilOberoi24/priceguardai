"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSession } from "@/lib/auth";

const organizations = ["Organization 1", "Demo Organization"];

export default function LoginPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState("");

  function enterPlatform() {
    if (!organization) return;
    saveSession({ name: "Admin", role: "Pricing Admin", brand: organization, avatar: "PG" });
    router.push("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="panel login-card">
        <div className="brand">
          <span className="brand-mark">PG</span>
          <span>
            PriceGuardrail <b>AI</b>
          </span>
        </div>
        <div className="eyebrow" style={{ marginTop: 34 }}>
          Pricing governance workspace
        </div>
        <h1>Make every price change defensible.</h1>
        <p className="subtext">Choose an organization to continue to the pricing workspace.</p>
        <div className="spacer" />
        {organizations.map((item) => (
          <button key={item} className={`org-option ${organization === item ? "selected" : ""}`} onClick={() => setOrganization(item)}>
            <span className="org-initial">{item.slice(0, 2).toUpperCase()}</span>
            <span style={{ textAlign: "left" }}>
              <b style={{ display: "block", fontSize: 12 }}>{item}</b>
              <small className="muted">Pricing workspace</small>
            </span>
          </button>
        ))}
        <button className="button primary" style={{ width: "100%", marginTop: 20 }} disabled={!organization} onClick={enterPlatform}>
          Continue to PriceGuardrail AI →
        </button>
      </section>
    </main>
  );
}
