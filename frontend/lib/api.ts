export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SKU = {
  sku_id: string;
  product_name: string;
  category: string;
  sub_category: string;
  type: string;
  list_price: number;
  unit_cost: number;
  margin_pct: number;
  avg_units_mo: number;
  revenue_12mo: number;
  trend: string;
  brand?: string;
  realization_rate?: number;
  months_since_reprice?: number;
};

export type PreviewRow = {
  sku_id: string;
  product_name: string;
  category: string;
  sub_category: string;
  current_lp: number;
  new_lp: number;
  proposed_pct: number;
  ds_base_pct?: number;
  macro_delta_pct?: number;
  new_margin_pct: number;
  current_margin_pct: number;
  revenue_uplift: number;
  confidence: number;
  guardrail_flags: { rule: string; type: string; msg: string }[];
  has_hard_block: boolean;
};

export type Project = {
  id: string;
  name: string;
  status: string;
  skus: SKU[];
  target_revenue: number;
  start_date: string;
  end_date: string;
  planner_output?: string;
  builder_output?: string;
  critic_output?: string;
  executor_output?: string;
  narrative_summary?: string;
  review_decisions?: Record<string, number>;
  committee_last_run?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  skus: () => request<SKU[]>("/api/skus"),
  assignments: () => request<Record<string, { project_id: string; project_name: string }>>("/api/sku-assignments"),
  projects: () => request<Project[]>("/api/projects"),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  preview: (id: string) => request<{ rows: PreviewRow[]; portfolio: Record<string, number> }>(`/api/projects/${id}/preview`),
  createProject: (body: object) => request<Project>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  review: (id: string, decisions: Record<string, number>) => request(`/api/projects/${id}/review-approve`, { method: "POST", body: JSON.stringify({ decisions }) }),
  complete: (id: string) => request(`/api/projects/${id}/complete`, { method: "POST" }),
  summarize: (id: string, body: object) => request<{ summary: string }>(`/api/projects/${id}/summarize`, { method: "POST", body: JSON.stringify(body) }),
  skipCommittee: (id: string) => request(`/api/projects/${id}/skip-committee`, { method: "POST" }),
};
