"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { api, SKU } from "@/lib/api";

export default function NewProjectPage() {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { project_id: string; project_name: string }>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [targetRevenue, setTargetRevenue] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [businessGroup, setBusinessGroup] = useState("All");
  const [brand, setBrand] = useState("All");
  const [category, setCategory] = useState("All");
  const [subCategory, setSubCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => { Promise.all([api.skus(), api.assignments()]).then(([catalog, locks]) => {
    setSkus(catalog);
    setAssignments(locks);
    const saved = sessionStorage.getItem("priceguardrail_selected_skus");
    if (saved) {
      try {
        const ids = JSON.parse(saved) as string[];
        const availableIds = new Set(catalog.filter((sku) => !locks[sku.sku_id]).map((sku) => sku.sku_id));
        setSelected(ids.filter((id) => availableIds.has(id)));
      } catch { sessionStorage.removeItem("priceguardrail_selected_skus"); }
    }
  }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const options = (key: "business_group" | "brand" | "category" | "sub_category") => {
    const values = skus.map((sku) => (sku as SKU & { business_group?: string })[key]).filter(Boolean) as string[];
    if ((key === "business_group" || key === "brand") && !values.length) values.push("Unspecified");
    return ["All", ...Array.from(new Set(values)).sort()];
  };
  const available = useMemo(() => skus.filter((sku) => !assignments[sku.sku_id]), [skus, assignments]);
  const shown = useMemo(() => available.filter((sku) => {
    const row = sku as SKU & { business_group?: string };
    return (businessGroup === "All" || (row.business_group || "Unspecified") === businessGroup) && (brand === "All" || (sku.brand || "Unspecified") === brand) && (category === "All" || sku.category === category) && (subCategory === "All" || sku.sub_category === subCategory) && `${sku.sku_id} ${sku.product_name} ${sku.sub_category}`.toLowerCase().includes(filter.toLowerCase());
  }), [available, businessGroup, brand, category, subCategory, filter]);

  async function createProject() {
    setError("");
    const today = new Date().toISOString().slice(0, 10);
    const target = Number(targetRevenue);
    if (!name.trim()) { setError("Enter a project name."); return; }
    if (targetRevenue === "" || !Number.isFinite(target) || target < 0) { setError("Enter a valid revenue target (zero or more)."); return; }
    if (!startDate || !endDate) { setError("Enter both the start date and review date."); return; }
    if (startDate < today) { setError("Start date cannot be before today."); return; }
    if (endDate <= startDate) { setError("Review date must be after the start date."); return; }
    if (!selected.length) { setError("Select at least one available SKU."); return; }
    setSaving(true);
    try {
      const project = await api.createProject({ name: name.trim(), group_field: "custom", group_value: "selection", sku_ids: selected, target_revenue: target, start_date: startDate, end_date: endDate });
      sessionStorage.removeItem("priceguardrail_selected_skus");
      window.location.href = `/projects/${project.id}`;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create project"); setSaving(false); }
  }
  const selectAll = () => setSelected((current) => Array.from(new Set([...current, ...shown.map((sku) => sku.sku_id)])));

  return <><Navbar /><main className="page project-page">
    <div className="project-breadcrumb"><Link href="/projects">← Projects</Link><span>/</span><h1>New Pricing Project</h1></div>
    {error && <div className="error">{error}</div>}
    <div className="project-layout">
      <div className="project-main">
        <section className="panel criteria-panel"><div className="panel-body"><h2>Select SKUs by Criteria</h2><div className="criteria-grid">
          <div className="field"><label>Business Group</label><select className="control" value={businessGroup} onChange={(e) => setBusinessGroup(e.target.value)}>{options("business_group").map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="field"><label>Brand</label><select className="control" value={brand} onChange={(e) => setBrand(e.target.value)}>{options("brand").map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="field"><label>Category</label><select className="control" value={category} onChange={(e) => setCategory(e.target.value)}>{options("category").map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="field"><label>Sub-Category</label><select className="control" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>{options("sub_category").map((v) => <option key={v}>{v}</option>)}</select></div>
        </div><div className="criteria-actions"><input className="control" placeholder="Search SKU or product…" value={filter} onChange={(e) => setFilter(e.target.value)} /><button className="button" disabled={!shown.length} onClick={selectAll}>Select all {shown.length} available SKUs</button><button className="button ghost" onClick={() => setSelected([])}>Clear selection</button></div></div></section>
        <section className="panel sku-panel"><div className="sku-count"><span>{shown.length} available</span><span className="muted">● Checking assignments…</span></div><div className="table-wrap"><table><thead><tr><th></th><th>SKU</th><th>Product</th><th>Sub-cat</th><th>Project</th><th>List Price</th><th>Margin</th><th>Trend</th><th>Mo Since</th></tr></thead><tbody>
          {shown.map((sku) => <tr key={sku.sku_id}><td><input type="checkbox" checked={selected.includes(sku.sku_id)} onChange={() => setSelected((items) => items.includes(sku.sku_id) ? items.filter((item) => item !== sku.sku_id) : [...items, sku.sku_id])} aria-label={`Select ${sku.sku_id}`} /></td><td className="mono">{sku.sku_id}</td><td>{sku.product_name}</td><td>{sku.sub_category}</td><td>—</td><td>${sku.list_price.toFixed(2)}</td><td>{(sku.margin_pct * 100).toFixed(1)}%</td><td>{sku.trend}</td><td>{sku.months_since_reprice ?? "—"}</td></tr>)}
        </tbody></table>{loading && <div className="empty">Loading catalog…</div>}{!loading && !shown.length && <div className="empty">No SKUs match the selected filters.</div>}</div></section>
      </div>
      <aside className="panel project-sidebar"><h2>Project Details</h2>
        <div className="field"><label>Project Name <i>*</i></label><input className="control" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Door Hardware Repricing" required /></div>
        <div className="field"><label>Revenue Target <i>*</i></label><div className="money-input"><span>$</span><input className="control" type="number" min="0" step="any" value={targetRevenue} onChange={(e) => setTargetRevenue(e.target.value)} placeholder="e.g. 250000" required /></div></div>
        <div className="criteria-grid date-grid"><div className="field"><label>Start Date <i>*</i></label><input className="control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div><div className="field"><label>Review By <i>*</i></label><input className="control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div></div>
        <div className="selected-skus"><div>Selected SKUs ({selected.length})</div>{selected.length ? <div className="selected-list">{selected.map((id) => <span key={id}>{id}</span>)}</div> : <em>No SKUs selected yet</em>}</div>
        <div className="project-meta"><div><span>Agents</span><strong>Planner · Builder · Critic · Executor</strong></div><div><span>DS Model</span><strong>DemandModel-v2.1</strong></div><div><span>Est. time</span><strong>~3–5 min</strong></div></div>
        <button className="button primary launch-button" disabled={saving || loading || !name.trim() || targetRevenue === "" || !Number.isFinite(Number(targetRevenue)) || Number(targetRevenue) < 0 || !startDate || !endDate || endDate <= startDate || !selected.length} onClick={createProject}>{saving ? "Creating project…" : "Create and Launch"}</button>
      </aside>
    </div>
  </main></>;
}
