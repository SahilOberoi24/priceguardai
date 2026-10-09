"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSession } from "@/lib/auth";

const organizations = ["Organization 1", "Demo Organization", "Enterprise Demo"];

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
      <div className="login-layout">
        <section className="login-intro" aria-labelledby="hero-title">
          <div className="brand">
            <span className="brand-mark">PG</span>
            <span>
              PriceGuard <b>AI</b>
            </span>
          </div>
          <div className="eyebrow">Agentic pricing governance</div>
          <h1 id="hero-title">
            Better pricing decisions, <span>with guardrails.</span>
          </h1>
          <p className="login-lede">
            Coordinate AI-assisted analysis with deterministic pricing checks and clear human
            approval—so every proposed change is explainable before it reaches execution.
          </p>

          <div className="login-workflow" aria-label="Pricing workflow">
            <p className="login-workflow-label">A governed workflow from SKU to decision</p>
            <div className="login-workflow-steps">
              <div className="login-workflow-step">
                <b>01 · PLAN</b>
                <strong>Agent committee</strong>
                <span>Planner, Builder, and Critic organize the pricing analysis.</span>
              </div>
              <div className="login-workflow-step">
                <b>02 · VALIDATE</b>
                <strong>Rules-based preview</strong>
                <span>Deterministic proposals surface margins and guardrail checks.</span>
              </div>
              <div className="login-workflow-step">
                <b>03 · APPROVE</b>
                <strong>Human review</strong>
                <span>Review and adjust SKU-level decisions before execution.</span>
              </div>
            </div>
          </div>

          <div className="login-principle">
            <span className="login-principle-mark" aria-hidden="true">✓</span>
            <span>
              AI provides narrative context; pricing calculations remain deterministic, with a
              pricing admin in control of approval.
            </span>
          </div>
        </section>

        <section className="panel login-card" aria-labelledby="login-title">
          <div className="eyebrow">Workspace access</div>
          <h2 id="login-title">Choose an organization</h2>
          <p className="login-card-copy">
            Choose a demo organization to continue.
          </p>
          <div className="login-org-list" aria-label="Available organizations">
            {organizations.map((item) => (
              <button
                key={item}
                className={`org-option ${organization === item ? "selected" : ""}`}
                onClick={() => setOrganization(item)}
                aria-pressed={organization === item}
              >
                <span className="org-initial">{item.slice(0, 2).toUpperCase()}</span>
                <span style={{ textAlign: "left" }}>
                  <b>{item}</b>
                </span>
              </button>
            ))}
          </div>
          <button className="button primary" style={{ width: "100%", marginTop: 20 }} disabled={!organization} onClick={enterPlatform}>
            Continue to workspace <span aria-hidden="true">→</span>
          </button>
          <p className="login-card-copy login-card-footer">
            Demo access only. Organization selection is stored in this browser.
          </p>
        </section>
      </div>
    </main>
  );
}
