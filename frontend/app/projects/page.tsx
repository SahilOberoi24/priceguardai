"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { api, Project } from "@/lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { api.projects().then(setProjects).catch((e: Error) => setError(e.message)); }, []);

  return <><Navbar /><main className="page">
    <div className="page-head"><div><div className="eyebrow">Pricing governance</div><h1>Pricing Projects</h1><p className="subtext">Track committee runs, human review, and execution.</p></div><Link className="button primary" href="/projects/new">+ Create New Project</Link></div>
    {error && <div className="error">{error}</div>}
    <section className="panel"><div className="panel-head"><div><h2>All projects</h2><div className="subtext">{projects.length} pricing initiatives</div></div></div>
      {projects.length === 0 ? <div className="empty">No pricing projects yet. Create a project and select SKUs to get started.</div> : <div className="table-wrap"><table><thead><tr><th>Project</th><th>SKUs</th><th>Target revenue</th><th>Start date</th><th>Review date</th><th>Status</th><th></th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><b>{project.name}</b><div className="muted mono" style={{ marginTop: 4 }}>{project.id}</div></td><td>{project.skus.length}</td><td>${project.target_revenue.toLocaleString()}</td><td>{project.start_date || "—"}</td><td>{project.end_date || "—"}</td><td><span className={`badge ${project.status === "complete" ? "green" : project.status === "pending" ? "blue" : "amber"}`}>{project.status.replace("_", " ")}</span></td><td><Link className="button" href={`/projects/${project.id}`}>Open →</Link></td></tr>)}</tbody></table></div>}
    </section>
  </main></>;
}
