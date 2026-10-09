"use client";

import { FormEvent, useState } from "react";
import { Navbar } from "@/components/Navbar";

type User = { name: string; email: string; role: string; status: string };
const seeds: User[] = [
  { name: "Owner Admin", email: "owner@example.com", role: "Admin", status: "Active" },
  { name: "Pricing Manager", email: "pricing@company.com", role: "Edit", status: "Active" },
  { name: "Read-only Viewer", email: "viewer@company.com", role: "Read", status: "Active" },
];

export default function AdminPage() {
  const [users, setUsers] = useState(seeds);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Edit");
  const [tab, setTab] = useState<"users" | "system">("users");
  const [notice, setNotice] = useState("");

  function invite(event: FormEvent) {
    event.preventDefault(); if (!email.trim()) return;
    setUsers((items) => [...items, { name: name.trim() || email.split("@")[0], email: email.trim(), role, status: "Invite Sent" }]);
    setName(""); setEmail(""); setNotice("Invite added to the demo list."); window.setTimeout(() => setNotice(""), 2500);
  }

  return <><Navbar /><main className="page"><div className="page-head"><div><div className="eyebrow">Workspace administration</div><h1>Admin Console</h1><p className="subtext">Manage demo users and view platform configuration.</p></div></div><div className="inline" style={{ borderBottom: "1px solid #26364c", marginBottom: 18 }}><button className="button ghost" onClick={() => setTab("users")}>User Management</button><button className="button ghost" onClick={() => setTab("system")}>System</button></div>
    {notice && <div className="badge green" style={{ marginBottom: 14 }}>{notice}</div>}
    {tab === "users" ? <><section className="panel" style={{ marginBottom: 18 }}><div className="panel-head"><div><h2>Invite a user</h2><div className="subtext">Add a demo user with the access level they need.</div></div></div><form className="panel-body" onSubmit={invite}><div className="form-grid"><div className="field"><label>NAME</label><input className="control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" /></div><div className="field"><label>EMAIL ADDRESS</label><input required type="email" className="control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></div><div className="field"><label>ACCESS LEVEL</label><select className="control" value={role} onChange={(e) => setRole(e.target.value)}><option>Read</option><option>Edit</option><option>Admin</option></select></div><div className="field" style={{ alignSelf: "end" }}><button className="button primary">Send invite →</button></div></div></form></section><section className="panel"><div className="panel-head"><div><h2>Platform users ({users.length})</h2><div className="subtext">{users.filter((user) => user.status === "Invite Sent").length} pending invitations</div></div></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Access</th><th>Status</th><th></th></tr></thead><tbody>{users.map((user) => <tr key={user.email}><td>{user.name}</td><td>{user.email}</td><td><select className="control" value={user.role} onChange={(e) => setUsers((items) => items.map((item) => item.email === user.email ? { ...item, role: e.target.value } : item))}><option>Read</option><option>Edit</option><option>Admin</option></select></td><td><span className={`badge ${user.status === "Active" ? "green" : "amber"}`}>{user.status}</span></td><td><button className="button ghost" onClick={() => setUsers((items) => items.filter((item) => item.email !== user.email))}>Remove</button></td></tr>)}</tbody></table></div></section></> : <section className="panel"><div className="panel-head"><div><h2>Platform information</h2><div className="subtext">Local development configuration</div></div></div><div className="panel-body kpi-grid">{[["Platform", "PriceGuardrail AI · development"], ["AI model", "Claude Sonnet 4.5 · OpenRouter"], ["Demand model", "DemandModel-v2.1 · 2025-03-15"], ["SKU catalog", "28 SKUs · electromechanical locks"], ["Macro data", "Mar-2025 · composite +4.8%"], ["Guardrails", "G1–G8 · deterministic"]].map(([label, value]) => <div className="agent-card" key={label}><div className="kpi-label">{label.toUpperCase()}</div><div style={{ marginTop: 9, fontSize: 13 }}>{value}</div></div>)}</div></section>}
  </main></>;
}
