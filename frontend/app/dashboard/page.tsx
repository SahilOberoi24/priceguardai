"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { api, SKU } from "@/lib/api";

export default function DashboardPage() {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { project_id: string; project_name: string }>>({});
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState("All categories");
  const [subCategory, setSubCategory] = useState("All sub-categories");
  const [activeTab, setActiveTab] = useState("Pricing");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { Promise.all([api.skus(), api.assignments()]).then(([items, locks]) => { setSkus(items); setAssignments(locks); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const categories = useMemo(() => ["All categories", ...Array.from(new Set(skus.map((sku) => sku.category)))], [skus]);
  const subCategories = useMemo(() => ["All sub-categories", ...Array.from(new Set(skus.filter((sku) => category === "All categories" || sku.category === category).map((sku) => sku.sub_category)))], [skus, category]);
  const filtered = useMemo(() => skus.filter((sku) => (category === "All categories" || sku.category === category) && (subCategory === "All sub-categories" || sku.sub_category === subCategory) && `${sku.sku_id} ${sku.product_name} ${sku.sub_category}`.toLowerCase().includes(query.toLowerCase())), [skus, category, subCategory, query]);
  const shown = useMemo(() => availableOnly ? filtered.filter((sku) => !assignments[sku.sku_id]) : filtered, [filtered, availableOnly, assignments]);
  const lockedCount = filtered.filter((sku) => assignments[sku.sku_id]).length;
  const viewRevenue = shown.reduce((sum, sku) => sum + sku.revenue_12mo, 0);
  const selectableShown = shown.filter((sku) => !assignments[sku.sku_id]);
  const allShownSelected = selectableShown.length > 0 && selectableShown.every((sku) => selected.includes(sku.sku_id));

  function toggleSku(skuId: string) {
    const next = selected.includes(skuId) ? selected.filter((id) => id !== skuId) : [...selected, skuId];
    setSelected(next);
    sessionStorage.setItem("priceguardrail_selected_skus", JSON.stringify(next));
  }

  function toggleAllAvailable() {
    const next = allShownSelected
      ? selected.filter((id) => !selectableShown.some((sku) => sku.sku_id === id))
      : Array.from(new Set([...selected, ...selectableShown.map((sku) => sku.sku_id)]));
    setSelected(next);
    sessionStorage.setItem("priceguardrail_selected_skus", JSON.stringify(next));
  }

  const newProjectHref = selected.length ? `/projects/new?sku_ids=${encodeURIComponent(selected.join(","))}` : "/projects/new";

  return <><Navbar /><main className="page explorer-page">
    <div className="page-head"><div><h1>SKU Explorer</h1><p className="subtext">Organization 1 · {loading ? "Loading catalog…" : `${skus.length} SKUs loaded`} · Select to build a pricing project</p></div><Link className="button primary new-project-button" href="/projects/new">＋ New Project</Link></div>
    <details className="signal-strip"><summary><span className="signal-icon">♟</span><strong>Macro Cost Signals</strong><span>Composite pressure: <b>+4.8%</b> · Mar-25</span><span>CPI (YoY): <b>+3.2%</b></span><span>PPI Metals: <b>+4.8%</b></span><span>Steel Index: <b>+6.1%</b></span><span>Zinc Spot: <b>+2.9%</b></span><span>+4 more…</span></summary><div className="signal-more">Macro indicators provide an at-a-glance view of input-cost pressure.</div></details>
    {error && <div className="error">{error}</div>}
    <section className="panel hierarchy-panel"><div className="panel-body"><div className="hierarchy-title">FILTER BY HIERARCHY</div><div className="hierarchy-grid"><label className="field"><span>Category</span><select className="control" value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory("All sub-categories"); }} aria-label="Filter category">{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Sub-Category</span><select className="control" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} aria-label="Filter sub-category">{subCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field hierarchy-search"><span>Search catalog</span><input className="control" placeholder="Search SKU or product name..." value={query} onChange={(e) => setQuery(e.target.value)} /></label></div></div></section>
    <div className="catalog-summary"><div className="catalog-tabs" role="tablist" aria-label="Catalog views">{["Pricing", "Sales & Volume", "Channel & Customer"].map((tab) => <button key={tab} className={activeTab === tab ? "catalog-tab active" : "catalog-tab"} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div><div className="catalog-summary-right"><button className={availableOnly ? "available-toggle active" : "available-toggle"} onClick={() => setAvailableOnly((value) => !value)} aria-pressed={availableOnly}>🔒 {availableOnly ? "Showing available only" : "Show available only"}</button><span className="catalog-totals">{shown.length} SKUs · Total 12mo Rev: <b>${(viewRevenue / 1_000_000).toFixed(1)}M</b></span></div></div>
    {lockedCount > 0 && <div className="locked-notice"><span>🔒</span><div><strong>{lockedCount} SKU{lockedCount === 1 ? "" : "s"} in this view</strong> are greyed out — already part of an active pricing project and cannot be selected. Click the project badge in the Project column to open that project.</div></div>}
    <section className="panel"><div className="panel-head"><div><h2>Product catalog</h2><div className="subtext">Filter by category or search SKU and product name.</div></div><div className="inline"><select className="control" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter category">{categories.map((item) => <option key={item}>{item}</option>)}</select><input className="control" placeholder="Search catalog…" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
      <div className="table-wrap"><table><thead><tr><th className="select-column"><label className="select-all-control"><input type="checkbox" checked={allShownSelected} disabled={!selectableShown.length} onChange={toggleAllAvailable} aria-label="Select all available SKUs in this view" /><span>Select all available</span></label></th><th>SKU / Product</th><th>Category</th><th>Sub-category</th><th>List price</th><th>Margin</th><th>Units / mo</th><th>Trend</th><th>Project status</th></tr></thead><tbody>
        {shown.map((sku) => { const locked = assignments[sku.sku_id]; return <tr className={locked ? "sku-locked" : ""} key={sku.sku_id}><td className="select-column"><input type="checkbox" checked={selected.includes(sku.sku_id)} disabled={!!locked} onChange={() => toggleSku(sku.sku_id)} aria-label={`Select ${sku.sku_id}`} /></td><td><b className="mono">{sku.sku_id}</b><div className="muted" style={{ marginTop: 4 }}>{sku.product_name}</div></td><td>{sku.category}</td><td>{sku.sub_category}</td><td>${sku.list_price.toFixed(2)}</td><td className={sku.margin_pct < .22 ? "warning" : ""}>{(sku.margin_pct * 100).toFixed(1)}%</td><td>{sku.avg_units_mo.toLocaleString()}</td><td>{sku.trend}</td><td>{locked ? <Link className="badge amber" href={`/projects/${locked.project_id}`}>In {locked.project_name}</Link> : <span className="badge green">Available</span>}</td></tr>; })}
      </tbody></table>{loading && <div className="empty">Loading catalog…</div>}{!loading && shown.length === 0 && <div className="empty">No SKUs match these filters.</div>}</div>
      <div className="panel-head"><span className="muted">Showing {shown.length} of {skus.length} SKUs</span><Link className="button primary" href="/projects/new">Create pricing project →</Link></div>
    </section>
  </main></>;
}
