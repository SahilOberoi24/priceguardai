"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { API_BASE, api, PreviewRow, Project } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };

export default function NegotiationPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.project(id), api.preview(id)]).then(([detail, preview]) => { setProject(detail); setRows(preview.rows); setSelected(preview.rows[0]?.sku_id || ""); }).catch((e: Error) => setError(e.message));
  }, [id]);
  const row = rows.find((item) => item.sku_id === selected);
  const sku = project?.skus.find((item) => item.sku_id === selected);

  async function send(event: FormEvent) {
    event.preventDefault(); if (!question.trim() || loading) return;
    const text = question.trim(); setQuestion(""); setLoading(true); setError("");
    setMessages((items) => [...items, { role: "user", content: text }, { role: "assistant", content: "" }]);
    const system = `You are PriceGuardrail AI, a pricing negotiation agent. Answer using only the supplied SKU facts; do not invent prices or change the deterministic recommendation. Be concise, specific, and data-driven. SKU: ${sku?.sku_id || "none"}; product: ${sku?.product_name || "none"}; current LP: $${row?.current_lp.toFixed(2) || "0.00"}; proposed change: ${row?.proposed_pct.toFixed(1) || "0.0"}%; confidence: ${((row?.confidence || 0) * 100).toFixed(0)}%; guardrails: ${(row?.guardrail_flags || []).map((flag) => `${flag.rule}: ${flag.msg}`).join("; ") || "none"}.`;
    try {
      const response = await fetch(`${API_BASE}/api/negotiate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system, question: text }) });
      if (!response.ok || !response.body) throw new Error("Negotiation request failed");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = "";
      while (true) { const chunk = await reader.read(); if (chunk.done) break; pending += decoder.decode(chunk.value, { stream: true }); const blocks = pending.split("\n\n"); pending = blocks.pop() || ""; for (const block of blocks) { const line = block.split("\n").find((part) => part.startsWith("data: ")); if (!line) continue; const value = JSON.parse(line.slice(6)) as { chunk?: string }; if (value.chunk) setMessages((items) => items.map((item, index) => index === items.length - 1 ? { ...item, content: item.content + value.chunk } : item)); } }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to contact the pricing agent."); }
    finally { setLoading(false); }
  }

  if (!project) return <><Navbar /><main className="page">{error ? <div className="error">{error}</div> : <div className="empty">Loading SKU analysis…</div>}</main></>;
  return <><Navbar /><main className="page"><div className="page-head"><div><div className="eyebrow">Project analysis</div><h1>Negotiate with agents</h1><p className="subtext">Challenge assumptions and explore alternatives for {project.name}.</p></div><Link className="button ghost" href={`/projects/${id}`}>← Back to project</Link></div>
    {error && <div className="error">{error}</div>}
    <div className="split"><section className="panel"><div className="panel-head"><div><h2>Price build-up</h2><div className="subtext">{rows.length} SKUs available · select one to analyze</div></div><select className="control" value={selected} onChange={(e) => setSelected(e.target.value)}>{rows.map((item) => <option key={item.sku_id} value={item.sku_id}>{item.sku_id} · {item.product_name}</option>)}</select></div>
      {row && sku ? <div className="panel-body"><div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))"}}><div className="agent-card"><div className="kpi-label">UNIT COST</div><div className="kpi-value">${sku.unit_cost.toFixed(2)}</div></div><div className="agent-card"><div className="kpi-label">CURRENT MARGIN</div><div className="kpi-value">{(row.current_margin_pct * 100).toFixed(1)}%</div></div><div className="agent-card"><div className="kpi-label">DS MODEL</div><div className="kpi-value">{row.proposed_pct.toFixed(1)}% <small className="muted">incl. macro</small></div></div><div className="agent-card"><div className="kpi-label">NEW LIST PRICE</div><div className="kpi-value positive">${row.new_lp.toFixed(2)}</div></div></div><div className="agent-card"><div className="agent-title">Recommendation evidence</div>{row.guardrail_flags.length ? row.guardrail_flags.map((flag) => <p key={flag.rule} className="subtext"><b className="warning">{flag.rule} · {flag.type}</b><br />{flag.msg}</p>) : <p className="subtext">No guardrail flags for this SKU.</p>}</div></div> : <div className="empty">No preview rows available for this project.</div>}
    </section><section className="panel"><div className="panel-head"><div><h2>Pricing Agent Chat</h2><div className="subtext">Ask why · challenge assumptions · request alternatives</div></div></div><div className="panel-body"><div style={{ minHeight: 280, maxHeight: 460, overflow: "auto", display: "grid", alignContent: "start", gap: 10 }}>{messages.length === 0 && <div className="empty">Try: “Why was this increase chosen?” or “What is the risk of this increase?”</div>}{messages.map((item, index) => <article className="agent-card" key={`${index}-${item.role}`}><div className="muted" style={{ fontSize: 9, marginBottom: 5 }}>{item.role === "user" ? "YOU" : "PRICING AGENT"}</div><div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{item.content || "…"}</div></article>)}</div><form onSubmit={send} className="inline" style={{ marginTop: 14 }}><input className="control" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Challenge a recommendation…" style={{ flex: 1 }} /><button className="button primary" disabled={loading || !question.trim()}>{loading ? "Thinking…" : "Send"}</button></form></div></section></div>
  </main></>;
}
