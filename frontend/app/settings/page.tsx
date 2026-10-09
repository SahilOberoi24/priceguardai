"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { api, SKU } from "@/lib/api";

type Rule = { id: string; name: string; type: string; applies: string; threshold: string; action: string; active: boolean };
const initialRules: Rule[] = [
  { id: "G1", name: "Max Single-Period Cap", type: "Hard Block", applies: "All SKUs", threshold: "Change > 8%", action: "Block → cap at 8%", active: true },
  { id: "G2", name: "Min Margin Floor", type: "Hard Block", applies: "All SKUs", threshold: "Margin < 20% + inc < 4%", action: "Force ≥ 4% increase", active: true },
  { id: "G3", name: "Margin Warning", type: "Soft Warn", applies: "All SKUs", threshold: "Margin < 22% + inc < 3%", action: "Suggest 3%", active: true },
  { id: "G4", name: "Volume Sensitivity", type: "Soft Warn", applies: "Units/Mo > 1,200", threshold: "Units > 1200 + inc > 5%", action: "Suggest ≤ 5%", active: true },
  { id: "G5", name: "Realization Gap", type: "Soft Warn", applies: "All SKUs", threshold: "Realization < 85%", action: "Warn — may not flow", active: true },
  { id: "G6", name: "Overdue Repricing", type: "Soft Warn", applies: "All SKUs", threshold: "Last reprice > 12 months", action: "Suggest ≥ 4.5%", active: true },
  { id: "G7", name: "Cost Absorption", type: "Soft Warn", applies: "All SKUs", threshold: "Inc < 50% of cost pressure", action: "Warn — under-absorbing", active: true },
  { id: "G8", name: "Configured SKU Cascade", type: "Information", applies: "Configured SKUs", threshold: "Type = Configured", action: "Verify component margin", active: true },
  { id: "G9", name: "Non-Negative Margin Floor", type: "Hard Block", applies: "All SKUs", threshold: "Final price < unit cost", action: "Block approval and execution", active: true },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<"rules" | "autonomy">("rules");
  const [rules, setRules] = useState(initialRules);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [saved, setSaved] = useState(false);
  const [newName, setNewName] = useState("");
  useEffect(() => {
    api.skus().then(setSkus).catch(() => undefined);
    if (new URLSearchParams(window.location.search).get("tab") === "autonomy") setTab("autonomy");
  }, []);
  const groups = useMemo(() => Array.from(new Set(skus.map((sku) => `${sku.category} · ${sku.sub_category}`))).sort(), [skus]);

  return <WorkspaceShell><main className="page"><div className="page-head"><div><div className="eyebrow">Workspace configuration</div><h1>Settings</h1><p className="subtext">Review guardrail display and approval routing preferences.</p></div></div>
    <div className="page-tabs"><button className={`button ghost ${tab === "rules" ? "badge blue" : ""}`} onClick={() => setTab("rules")}>Rule Engine</button><button className={`button ghost ${tab === "autonomy" ? "badge blue" : ""}`} onClick={() => setTab("autonomy")}>Autonomy Configuration</button></div>
    {tab === "rules" ? <section className="panel"><div className="panel-head"><div><h2>Guardrail rules</h2><div className="subtext">Display configuration for the G1–G8 deterministic checks.</div></div><div className="inline"><input className="control" placeholder="New rule name" value={newName} onChange={(e) => setNewName(e.target.value)} /><button className="button" onClick={() => { if (newName.trim()) { setRules((items) => [...items, { id: `G${Date.now()}`, name: newName.trim(), type: "Soft Warn", applies: "All SKUs", threshold: "Custom threshold", action: "Review required", active: true }]); setNewName(""); } }}>＋ Add rule</button></div></div><div className="table-wrap"><table><thead><tr><th>Rule</th><th>Type</th><th>Applies to</th><th>Threshold</th><th>Action</th><th>Active</th><th></th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id} style={{ opacity: rule.active ? 1 : .45 }}><td><b className="mono">{rule.id}</b><div style={{ marginTop: 4 }}>{rule.name}</div></td><td><span className={`badge rule-type-badge ${rule.type === "Hard Block" ? "red" : rule.type === "Information" ? "blue" : "amber"}`}>{rule.type}</span></td><td>{rule.applies}</td><td className="mono">{rule.threshold}</td><td>{rule.action}</td><td><button className={`badge ${rule.active ? "green" : ""}`} onClick={() => setRules((items) => items.map((item) => item.id === rule.id ? { ...item, active: !item.active } : item))}>{rule.active ? "On" : "Off"}</button></td><td><button className="button ghost" onClick={() => setRules((items) => items.filter((item) => item.id !== rule.id))}>Delete</button></td></tr>)}</tbody></table></div><div className="panel-body muted" style={{ fontSize: 11 }}>This screen is a local display preference. The deterministic backend rules are fixed and are not changed by these controls.</div></section> : <section className="panel"><div className="panel-head"><div><h2>Approval routing</h2><div className="subtext">Assign a review tier by product group. Routing is informational in this prototype.</div></div><button className="button primary" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}>{saved ? "✓ Saved" : "Save configuration"}</button></div><div className="panel-body"><div className="kpi-grid"><div className="agent-card"><span className="badge green">Tier A · Auto-Apply</span><p className="subtext">Low-risk changes. No approval required.</p></div><div className="agent-card"><span className="badge amber">Tier B · Pricing Approval</span><p className="subtext">Standard changes. Pricing team review.</p></div><div className="agent-card"><span className="badge red">Tier C · Admin Approval</span><p className="subtext">Strategic changes. Admin review.</p></div></div><div className="table-wrap"><table><thead><tr><th>Product group</th><th>SKUs</th><th>Approval tier</th></tr></thead><tbody>{groups.map((group) => <tr key={group}><td>{group}</td><td>{skus.filter((sku) => `${sku.category} · ${sku.sub_category}` === group).length}</td><td><select className="control" defaultValue="B"><option value="A">A · Auto-Apply</option><option value="B">B · Pricing Approval</option><option value="C">C · Admin Approval</option></select></td></tr>)}</tbody></table></div></div></section>}
  </main></WorkspaceShell>;
}
