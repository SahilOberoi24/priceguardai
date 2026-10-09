"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { API_BASE, api, PreviewRow, Project } from "@/lib/api";

type Phase = "idle" | "running" | "awaiting_review" | "executing" | "complete";
type ChatMessage = { role: "user" | "assistant"; content: string };

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [portfolio, setPortfolio] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [agentText, setAgentText] = useState<Record<string, string>>({ planner: "", builder: "", critic: "", executor: "" });
  const [activeAgent, setActiveAgent] = useState("");
  const [toolCount, setToolCount] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const loadProject = useCallback(async () => {
    const result = await api.project(id);
    setProject(result);
    setAgentText({ planner: result.planner_output || "", builder: result.builder_output || "", critic: result.critic_output || "", executor: result.executor_output || "" });
    setSummary(result.narrative_summary || "");
    if (result.status === "complete") setPhase("complete");
    else if (["review_complete", "executing"].includes(result.status) || result.critic_output) setPhase("awaiting_review");
    if (result.status !== "pending" || result.critic_output) {
      const preview = await api.preview(id);
      setRows(preview.rows);
      setPortfolio(preview.portfolio);
    }
  }, [id]);

  useEffect(() => { loadProject().catch((e: Error) => setError(e.message)); }, [loadProject]);

  function runCommittee() {
    setError(""); setPhase("running"); setToolCount(0);
    setAgentText({ planner: "", builder: "", critic: "", executor: "" });
    const streamedText: Record<string, string> = { planner: "", builder: "", critic: "", executor: "" };
    const stream = new EventSource(`${API_BASE}/api/projects/${id}/committee/stream`);
    stream.onmessage = (incoming) => {
      const event = JSON.parse(incoming.data) as { agent?: string; chunk?: string; done?: boolean; full?: string; phase?: string; tool_call?: unknown };
      if (event.agent === "system") setAgentText((value) => ({ ...value, system: (value.system || "") + (event.chunk || "") }));
      if (event.agent && ["planner", "builder", "critic", "executor"].includes(event.agent)) {
        setActiveAgent(event.agent);
        if (event.chunk) {
          streamedText[event.agent] += event.chunk;
          setAgentText((value) => ({ ...value, [event.agent!]: value[event.agent!] + event.chunk }));
        }
      }
      if (event.tool_call) setToolCount((count) => count + 1);
      if (event.phase === "awaiting_review") {
        stream.close(); setPhase("awaiting_review");
        void api.preview(id).then((preview) => { setRows(preview.rows); setPortfolio(preview.portfolio); });
        void api.summarize(id, { planner_text: streamedText.planner, builder_text: streamedText.builder, critic_text: streamedText.critic }).then((result) => setSummary(result.summary)).catch(() => undefined);
      }
    };
    stream.onerror = () => { stream.close(); setPhase((value) => value === "running" ? "idle" : value); setError("The committee stream stopped. Re-run the agents to continue."); };
  }

  async function priceManually() {
    try { await api.skipCommittee(id); const preview = await api.preview(id); setRows(preview.rows); setPortfolio(preview.portfolio); setPhase("awaiting_review"); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load preview"); }
  }

  async function submitForExecution() {
    const decisions = Object.fromEntries(rows.map((row) => {
      const parsed = Number.parseFloat(overrides[row.sku_id] || "");
      return [row.sku_id, Number.isFinite(parsed) && parsed !== 0 ? parsed : row.proposed_pct];
    }));
    try {
      await api.review(id, decisions); setPhase("executing"); setError("");
      const stream = new EventSource(`${API_BASE}/api/projects/${id}/executor/stream`);
      stream.onmessage = (incoming) => {
        const event = JSON.parse(incoming.data) as { agent?: string; chunk?: string; done?: boolean; phase?: string };
        if (event.chunk) setAgentText((value) => ({ ...value, executor: value.executor + event.chunk }));
        if (event.phase === "complete") { stream.close(); void api.complete(id).then(() => { setPhase("complete"); void loadProject(); }).catch((e: Error) => setError(e.message)); }
      };
      stream.onerror = () => { stream.close(); setPhase("awaiting_review"); setError("Execution stream stopped before completion."); };
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit decisions"); }
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || chatLoading) return;
    const question = message.trim(); const prior = chat;
    setChat((items) => [...items, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setMessage(""); setChatLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}/negotiate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question, history: prior, executor_output: summary || "Committee pricing analysis not yet summarised.", preview_rows: rows }) });
      if (!response.ok || !response.body) throw new Error("Negotiation request failed");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = "";
      while (true) { const { value, done } = await reader.read(); if (done) break; pending += decoder.decode(value, { stream: true }); const blocks = pending.split("\n\n"); pending = blocks.pop() || ""; for (const block of blocks) { const line = block.split("\n").find((part) => part.startsWith("data: ")); if (!line) continue; const data = JSON.parse(line.slice(6)) as { chunk?: string }; if (data.chunk) setChat((items) => items.map((item, index) => index === items.length - 1 ? { ...item, content: item.content + data.chunk } : item)); } }
    } catch { setChat((items) => items.map((item, index) => index === items.length - 1 ? { ...item, content: "Unable to reach the negotiation agent. Please try again." } : item)); }
    finally { setChatLoading(false); }
  }

  if (!project && !error) return <><Navbar /><main className="page"><div className="empty">Loading pricing project…</div></main></>;
  if (!project) return <><Navbar /><main className="page"><div className="error">{error}</div><Link href="/projects" className="button">← Back to projects</Link></main></>;

  const phaseLabel = phase === "awaiting_review" ? "Human review" : phase === "complete" ? "Execution complete" : phase === "running" ? "Committee running" : phase === "executing" ? "Applying approved prices" : "Ready to price";
  const avgDsBase = rows.length ? rows.reduce((sum, row) => sum + (row.ds_base_pct ?? 0), 0) / rows.length : 0;
  const avgMacroDelta = rows.length ? rows.reduce((sum, row) => sum + (row.macro_delta_pct ?? 0), 0) / rows.length : 0;
  return <><Navbar /><main className="page">
    <div className="page-head"><div><div className="eyebrow">Pricing project · {project.id}</div><h1>{project.name}</h1><p className="subtext">{project.skus.length} SKUs · Review by {project.end_date || "not set"}</p></div><div className="inline"><span className={`badge ${phase === "complete" ? "green" : phase === "running" || phase === "executing" ? "amber" : "blue"}`}>{phaseLabel}</span><Link className="button ghost" href="/projects">← Projects</Link></div></div>
    {error && <div className="error">{error}</div>}
    <section className="kpi-grid">
      <div className="panel kpi"><div className="kpi-label">CURRENT REVENUE · 12 MO</div><div className="kpi-value">${Number(portfolio.current_revenue_12mo || 0).toLocaleString()}</div></div>
      <div className="panel kpi"><div className="kpi-label">EXPECTED UPLIFT</div><div className="kpi-value positive">${Number(portfolio.revenue_uplift || 0).toLocaleString()}</div></div>
      <div className="panel kpi"><div className="kpi-label">AVG. PROPOSED CHANGE</div><div className="kpi-value">{Number(portfolio.avg_proposed_pct || 0).toFixed(2)}%</div></div>
      <div className="panel kpi"><div className="kpi-label">GUARDRAIL REVIEW</div><div className="kpi-value">{Number(portfolio.skus_with_hard_block || 0)} <span className="danger" style={{ fontSize: 12 }}>blocks</span> / {Number(portfolio.skus_with_warnings || 0)} <span className="warning" style={{ fontSize: 12 }}>flags</span></div></div>
    </section>
    <section className="panel" style={{ marginBottom: 18 }}><div className="panel-head"><div><h2>Pricing committee</h2><div className="subtext">AI agents provide narrative analysis; the pricing preview is deterministic.</div></div><div className="inline"><button className="button" onClick={priceManually} disabled={phase === "running" || phase === "executing"}>Price manually</button><button className="button primary" onClick={runCommittee} disabled={phase === "running" || phase === "executing"}>{phase === "running" ? "Agents running…" : "⚡ Run agents"}</button></div></div>
      {phase === "running" && <div className="panel-body"><div className="progress"><span className="progress-step"><i className={activeAgent === "planner" ? "active" : ""} />Planner</span><span className="progress-step"><i className={activeAgent === "builder" ? "active" : ""} />Builder</span><span className="progress-step"><i className={activeAgent === "critic" ? "active" : ""} />Critic</span><span className="tool-call-count">{toolCount} tool calls</span></div></div>}
      {(agentText.planner || agentText.builder || agentText.critic) && <div className="panel-body agent-stack">{(["planner", "builder", "critic"] as const).map((agent) => agentText[agent] && <article className={`agent-card agent-${agent}`} key={agent}><div className="agent-title"><span>{agent[0].toUpperCase() + agent.slice(1)} Agent</span><span className="badge blue">Narrative analysis</span></div><div className="agent-text">{agentText[agent]}</div></article>)}</div>}
    </section>
    {summary && <section className="panel summary" style={{ marginBottom: 18 }}><div className="panel-head"><div><h2>Price increase summary</h2><div className="subtext">Committee narrative for this pricing cycle</div></div></div><div className="panel-body"><div className="summary-metrics"><div className="summary-metric model"><small>DS MODEL</small><strong>{avgDsBase.toFixed(1)}%</strong><span>average base recommendation</span></div><div className="summary-metric macro"><small>MACRO Δ</small><strong>+{avgMacroDelta.toFixed(1)}%</strong><span>external cost signals</span></div><div className="summary-metric total"><small>TOTAL PROPOSED</small><strong>{Number(portfolio.avg_proposed_pct || 0).toFixed(1)}%</strong><span>committee recommendation</span></div></div><div className="summary-copy">{summary}</div></div></section>}
    <section className="panel" style={{ marginBottom: 18 }}><div className="panel-head"><div><h2>{phase === "complete" ? "Applied pricing decisions" : "Deterministic preview & human review"}</h2><div className="subtext">Review guardrail evidence and adjust a final increase per SKU.</div></div>{rows.length > 0 && phase !== "complete" && <button className="button primary" onClick={submitForExecution} disabled={phase === "running" || phase === "executing"}>✓ Submit for execution</button>}</div>
      {rows.length === 0 ? <div className="empty">Run the committee or choose Price manually to generate the pricing preview.</div> : <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Current LP</th><th>Proposed</th><th>Final increase</th><th>New LP</th><th>New margin</th><th>12-mo uplift</th><th>Guardrails</th></tr></thead><tbody>{rows.map((row) => { const finalPct = Number.parseFloat(overrides[row.sku_id] || "") || row.proposed_pct; return <tr key={row.sku_id}><td><b className="mono">{row.sku_id}</b><div className="muted" style={{ marginTop: 4 }}>{row.product_name}</div></td><td>${row.current_lp.toFixed(2)}</td><td>{row.proposed_pct.toFixed(1)}%</td><td>{phase === "complete" ? <b>{(project.review_decisions?.[row.sku_id] ?? row.proposed_pct).toFixed(1)}%</b> : <input aria-label={`Final increase for ${row.sku_id}`} className="control" style={{ width: 90, minWidth: 0 }} type="number" min="0" max="15" step="0.1" value={overrides[row.sku_id] ?? row.proposed_pct} onChange={(e) => setOverrides((value) => ({ ...value, [row.sku_id]: e.target.value }))} />}</td><td>${(row.current_lp * (1 + finalPct / 100)).toFixed(2)}</td><td>{(row.new_margin_pct * 100).toFixed(1)}%</td><td className="positive">${row.revenue_uplift.toLocaleString()}</td><td>{row.guardrail_flags.length ? row.guardrail_flags.map((flag) => <span key={flag.rule} title={flag.msg} className={`badge ${flag.type === "Hard Block" ? "red" : flag.type === "Info" ? "blue" : "amber"}`} style={{ margin: 2 }}>{flag.rule}</span>) : <span className="muted">—</span>}</td></tr>; })}</tbody></table></div>}
    </section>
    {agentText.executor && <section className="panel" style={{ marginBottom: 18 }}><div className="panel-head"><h2>Executor confirmation</h2></div><div className="panel-body agent-text">{agentText.executor}</div></section>}
    {rows.length > 0 && <section className="panel"><div className="panel-head"><div><h2>Negotiation agent</h2><div className="subtext">Ask about drivers, risk, or alternatives for this project.</div></div></div><div className="panel-body"><div style={{ maxHeight: 240, overflow: "auto", display: "grid", gap: 10, marginBottom: 12 }}>{chat.map((item, index) => <div key={`${index}-${item.role}`} className="agent-card" style={{ borderColor: item.role === "user" ? "#31588c" : undefined }}><div className="muted" style={{ fontSize: 9, marginBottom: 5 }}>{item.role === "user" ? "YOU" : "PRICING AGENT"}</div><div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{item.content || "…"}</div></div>)}</div><form className="inline" onSubmit={sendChat}><input className="control" style={{ flex: 1 }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask why this increase was proposed…"/><button className="button primary" disabled={chatLoading || !message.trim()}>{chatLoading ? "Sending…" : "Send"}</button></form></div></section>}
  </main></>;
}
