# PRICING_AGENT_SPEC.md — PriceMind AI (Pricing Agent) Implementation Specification

> **Purpose.** This is the reference for recreating the **Pricing Agent**, branded **"PriceMind AI — Agentic Pricing Committee"**, from end to end in a separate codebase. It was reverse-engineered from `priceagent/` in a source repository. **User/account identifiers have been redacted.**
>
> **Evidence labels used throughout:**
> - **[CODE]**: read directly from source.
> - **[RUN]**: observed by running the real backend locally (FastAPI `TestClient`, throwaway SQLite database, LLM calls *not* executed).
> - **[INFERRED]**: reasoned from code but not executed.
> - **[UNVERIFIED]**: could not be confirmed.
>
> No screen was visually inspected in a browser. All UI descriptions come from the code (Tailwind class names), and none were checked visually.
>
> **Secrets.** No secret values are reproduced here. Environment variables are listed by name only.

---

## Table of Contents

1. [Executive Summary and Pricing Agent Scope](#1-executive-summary-and-pricing-agent-scope)
2. [Pricing Agent Feature Inventory](#2-pricing-agent-feature-inventory)
3. [Repository Structure and Technology Stack](#3-repository-structure-and-technology-stack)
4. [Pricing Agent Architecture Diagram](#4-pricing-agent-architecture-diagram)
5. [Pricing Agent Routes and Navigation](#5-pricing-agent-routes-and-navigation)
6. [UI/UX and Design System](#6-uiux-and-design-system)
7. [Screen-by-Screen Specifications](#7-screen-by-screen-specifications)
8. [Frontend Components and State Management](#8-frontend-components-and-state-management)
9. [Frontend-to-Backend Integration Map](#9-frontend-to-backend-integration-map)
10. [Complete Backend API Reference](#10-complete-backend-api-reference)
11. [Pricing Engine and Business Rules](#11-pricing-engine-and-business-rules)
12. [AI/LLM Workflow and Prompt Specification](#12-aillm-workflow-and-prompt-specification)
13. [Database Schema and ER Diagram](#13-database-schema-and-er-diagram)
14. [External Integrations and Dependencies](#14-external-integrations-and-dependencies)
15. [Authentication, Authorization, and Security](#15-authentication-authorization-and-security)
16. [Error Handling and Edge Cases](#16-error-handling-and-edge-cases)
17. [Environment Setup and Execution](#17-environment-setup-and-execution)
18. [Testing and Acceptance Criteria](#18-testing-and-acceptance-criteria)
19. [Codex Implementation Plan](#19-codex-implementation-plan)
20. [Known Gaps, Assumptions, and Unresolved Questions](#20-known-gaps-assumptions-and-unresolved-questions)
21. [Appendix: Relevant Files, Assets, Configuration, and Commands](#21-appendix-relevant-files-assets-configuration-and-commands)
22. [Codex Execution Kit](#22-codex-execution-kit)

---

## 1. Executive Summary and Pricing Agent Scope

### 1.1 What it is

PriceMind AI is a proof-of-concept B2B **list-price repricing platform**. A pricing admin works through these steps:

1. Browses a fixed catalog of **28 lock-hardware SKUs** in the "SKU Explorer".
2. Groups SKUs into a **Pricing Project**. Each SKU can belong to at most one project.
3. Launches an **AI "committee"** that streams its work live over Server-Sent Events (SSE). The agents run in sequence: **Planner → Builder → Critic**. Before the Builder streams, the server emits five simulated "tool calls".
4. Reads an LLM-generated **executive summary**. The UI also shows a **deterministic preview grid** of proposed % increases, computed from a simulated DS model plus a fixed macro delta and guardrail checks G1–G8.
5. Optionally **chats with a Negotiation Agent** (streamed LLM).
6. **Overrides** % per SKU or per sub-category group, then submits. This is the human-in-the-loop (HITL) step.
7. An **Executor agent** streams an implementation confirmation. The project is then marked **complete** and a `pricing_history` row is written for each SKU.

A user can instead choose **"Price Manually"**, which skips the committee and goes straight to the override grid.

### 1.2 Key architectural fact

The **numbers** in the UI (proposed %, new list price, margin, revenue uplift, guardrail flags) come from **deterministic Python** (`data_loader.compute_preview`). They do **not** come from the LLM. The LLM agents produce **narrative text only**. Their output is shown, persisted, and summarized, but it is **never parsed** into the numeric grid. The Executor's `<RECOMMENDATIONS_JSON>` block is requested in its prompt and then ignored by the code. See §11 and §12.

### 1.3 In scope (Pricing Agent boundary)

| Area | Paths |
|---|---|
| Backend (FastAPI) | `priceagent/backend/main.py`, `models.py`, `database.py`, `data_loader.py`, `agents/prompts.py`, `agents/__init__.py`, `data/sku_data.json`, `requirements.txt`, `Dockerfile`, `railway.toml`, `.env.example` (key names only) |
| Frontend (Next.js) | `priceagent/frontend/app/**` (all routes), `components/Navbar.tsx`, `components/Providers.tsx`, `lib/api.ts`, `lib/auth.ts`, `app/globals.css`, `app/layout.tsx`, config files (`package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `vercel.json`), `app/favicon.ico` |
| Dev tooling | `priceagent/package.json` (concurrently runner), `priceagent/start.bat` |

### 1.4 Explicitly out of scope (other projects in the same repo)

The following are ignored except where noted:
- Root portfolio site: `index.html`, `blog/`, `data/*.js`, `assets/`, the root `vercel.json`, and `README.md`.
- The IPL predictor: `ipl/`, `APP_VISUAL_GUIDE.md`, and `api/predict.js`.
- `priceagent/app.py`: an unrelated Flask + Supabase "todos" demo that the Pricing Agent never imports.
- `priceagent/supabase.ipynb`: an unrelated notebook.
- `PriceAgent_SKU_Data.xlsx` at the repository root (untracked) is **probably** the spreadsheet that `sku_data.json` was generated from **[INFERRED]**. The first element of the `guardrails` array is a spreadsheet header row. No conversion script exists in the repo.
- `priceagent/README.md` and `START.md` are **outdated**. They mention a legacy provider key and a different four-agent lineup ("Builder/Critic/Coding/Executor"). **Follow the code, not these READMEs.**

### 1.5 Deployment (as configured in the repo)

- **Frontend:** Vercel. `priceagent/frontend/vercel.json` bakes a deployment URL in at build time. The deployment/account URL and project identifier have been redacted. The portfolio links the live app at `https://pricemindai.vercel.app/` (`data/projects.js`) **[CODE]**.
- **Backend:** Render (from git history: "Point frontend to Render backend"). There is **no Render config file** in the repo. The backend ships a `Dockerfile` and a `railway.toml` (Railway health check `/api/skus`). How Render is set up (Docker vs. native Python) is **[UNVERIFIED]**.
- **Database:** PostgreSQL, through `DATABASE_URL` (driver `psycopg2-binary`). The provider is **[UNVERIFIED]**. SQLite also works and was verified locally **[RUN]**.

---

## 2. Pricing Agent Feature Inventory

Status legend: **Implemented** = works end to end with the backend. **UI-only** = client-side state only, nothing persisted, no effect on pricing. **Partial** = present, but broken or incomplete in a specific way.

| # | Feature | Purpose / user problem | Entry point | Frontend | Backend / data | Status |
|---|---|---|---|---|---|---|
| F1 | Demo login (org picker) | Choose a tenant "organization" to enter the demo | `/` | `app/page.tsx`, `Providers`, `lib/auth.ts` | none (localStorage) | Implemented (mock; no real auth) |
| F2 | SKU Explorer | Browse the catalog, filter by hierarchy, see which SKUs are locked to projects | `/dashboard` (navbar "SKU Explorer") | `app/dashboard/page.tsx` | `GET /api/skus`, `GET /api/sku-assignments` | Implemented |
| F3 | Macro cost signals panel | Show input-cost pressure context | `/dashboard` collapsible panel | hard-coded `MACRO` array | none (static strings) | Implemented (static) |
| F4 | Quick-create project (modal) | Create a project from SKUs selected in the explorer | `/dashboard` → select → "🚀 Create Pricing Project" | dashboard modal | `POST /api/projects` | Partial: no error handling on 409/422 (button stays "Creating…") |
| F5 | New Project page | Create a project with filters, chips, and validation | `/projects/new` (buttons "+ New Project") | `app/projects/new/page.tsx` | `GET /api/skus`, `GET /api/sku-assignments`, `POST /api/projects` | Implemented |
| F6 | Projects list | List, filter by status, open, edit, delete projects | `/projects` (navbar "Pricing Projects") | `app/projects/page.tsx` | `GET /api/projects` | Implemented |
| F7 | Edit project (modal) | Rename, change target/dates, add/remove SKUs (adds reset pricing) | `/projects` card hover → "✏️ Edit" | same | `PATCH /api/projects/{pid}`, lazy `GET /api/skus` + `/api/sku-assignments` | Implemented |
| F8 | Delete project (confirm modal) | Remove a project and free its SKUs | `/projects` card hover → "🗑 Delete" | same | `DELETE /api/projects/{pid}` | Implemented |
| F9 | Project workspace | Single page that drives the whole pricing lifecycle | `/projects/{id}` | `app/projects/[id]/page.tsx` | `GET /api/projects/{pid}`, `GET /api/macro`, `GET /api/projects/{pid}/preview` | Implemented |
| F10 | AI committee run (SSE) | Planner → Builder (+5 simulated tool calls) → Critic streamed live | "⚡ Run Agents" / "Re-run Agents" | same | `GET /api/projects/{pid}/committee/stream` → OpenRouter LLM ×3 | Implemented |
| F11 | Stop agents | Abort a running committee and discard its output | "⏹ Stop Agents" → confirm modal | same | closes EventSource only; **no backend call** | Partial (server status stays `running`) |
| F12 | Ambient agents panel | Macro signals tuned to the project's sub-category mix, plus a static "Sales & Demand" card | always on the project page | same | `GET /api/macro`, preview rows | Implemented (signal card computed; demand card mostly static) |
| F13 | Price Increase Summary | LLM 250–300 word executive summary of committee output | auto after the committee finishes | same | `POST /api/projects/{pid}/summarize` → LLM | Implemented |
| F14 | Deterministic preview grid / KPIs | Proposed % per SKU, new LP, margin, uplift, guardrail flags, KPI tiles | after committee or Manual | same | `GET /api/projects/{pid}/preview` (`compute_preview`) | Implemented |
| F15 | Inline negotiation chat | Ask the Negotiation Agent questions (streamed); history persisted per project in localStorage | "💬 Open Negotiation Chat" | same | `POST /api/projects/{pid}/negotiate` → LLM | Implemented |
| F16 | Full negotiation page | 3-column SKU waterfall, insights, and chat | "Full Analysis ↗" in the chat header | `app/projects/[id]/negotiate/page.tsx` | `POST /api/negotiate` → LLM | **Partial**: relies on sessionStorage that is never written (§16), so normally shows 0 SKUs |
| F17 | Override grid (HITL) | Set final % per SKU or per sub-category group | Phase 3 grid | same | client state | Implemented |
| F18 | Submit for execution + Executor (SSE) | Persist decisions, stream Executor, mark complete, write history | "✅ Submit for Execution" | same | `POST …/review-approve`, `GET …/executor/stream` → LLM, `POST …/complete` | Implemented |
| F19 | Price manually | Skip the AI and go straight to the override grid | "✏️ Price Manually" | same | `POST …/skip-committee` (no-op) or `POST …/reset` (if complete), then `GET …/preview` | Implemented |
| F20 | Re-run / Reopen for pricing | Reset the project and clear outputs/decisions | "↺ Re-run Agents" / "↺ Reopen for Pricing" | same | `POST …/reset` | Implemented |
| F21 | In-app notifications | Bell dropdown with seeded and event notifications | Navbar bell | `Navbar`, `Providers` | none (in-memory) | Implemented (UI-only, lost on reload) |
| F22 | Settings: Rule Engine tab | View/add/edit/toggle/delete guardrail rules | Navbar ⚙ → `/settings` | `app/settings/page.tsx` | none | **UI-only**: does **not** affect backend guardrails |
| F23 | Settings: Autonomy tab | Assign approval tier A/B/C per sub-category | `/settings` tab 2 | same | `GET /api/skus` (for grouping) | **UI-only** |
| F24 | Admin Console | Invite users, change access, system info | Navbar 🛡 → `/admin` | `app/admin/page.tsx` | none | **UI-only** |
| F25 | Standalone `/rules` page | Older duplicate of the Rule Engine tab | URL only (no link anywhere) | `app/rules/page.tsx` | none | UI-only, orphaned |
| F26 | Standalone `/autonomy` page | Older duplicate of the Autonomy tab (richer legend) | URL only (no link anywhere) | `app/autonomy/page.tsx` | `GET /api/skus` | UI-only, orphaned |
| F27 | Backend-only data endpoints | `GET /api/hierarchy`, `/api/guardrails`, `/api/history/{sku_id}`, `/api/ds-model/predictions`, `POST /api/projects/{pid}/approve` | none: **not called by the frontend** | — | implemented | Implemented, unused |

**Not present anywhere (do not build):** real authentication, role enforcement, CSV/Excel export, data upload/ingestion UI, competitor-price data, a price-history viewer UI (the `pricing_history` table is write-only), pagination, sorting controls, automated tests.

---

## 3. Repository Structure and Technology Stack

### 3.1 Pricing Agent tree

```
priceagent/
├── package.json            # root dev runner: "dev" runs API + UI via concurrently
├── start.bat               # Windows launcher (hard-coded absolute paths)
├── backend/
│   ├── main.py             # FastAPI app: all routes, SSE orchestration, startup migration
│   ├── models.py           # SQLAlchemy ORM: Project, ProjectSku, ReviewDecision, PricingHistory
│   ├── database.py         # lazy engine/session from DATABASE_URL
│   ├── data_loader.py      # JSON catalog loader + deterministic pricing engine
│   ├── agents/prompts.py   # 5 system prompts + 5 prompt builders
│   ├── data/sku_data.json  # catalog, 12-mo history, macro indicators, guardrails, component map (98 KB)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── railway.toml
│   └── .env.example        # contains OPENROUTER_API_KEY (see §15 security finding)
└── frontend/               # Next.js App Router, TypeScript, Tailwind v4
    ├── app/
    │   ├── layout.tsx, globals.css, favicon.ico
    │   ├── page.tsx                      # "/" login
    │   ├── dashboard/page.tsx            # "/dashboard" SKU Explorer
    │   ├── projects/page.tsx             # "/projects"
    │   ├── projects/new/page.tsx         # "/projects/new"
    │   ├── projects/[id]/page.tsx        # "/projects/:id" workspace (1,496 lines)
    │   ├── projects/[id]/negotiate/page.tsx
    │   ├── settings/page.tsx, admin/page.tsx, rules/page.tsx, autonomy/page.tsx
    ├── components/Navbar.tsx, components/Providers.tsx
    ├── lib/api.ts, lib/auth.ts
    ├── public/*.svg        # create-next-app defaults, NOT used by any page
    └── package.json, next.config.ts, tsconfig.json, postcss.config.mjs, eslint.config.mjs, vercel.json
```

### 3.2 Stack (exact versions)

| Layer | Technology | Version (source) |
|---|---|---|
| Backend language | Python | 3.11 (`Dockerfile: python:3.11-slim`); verified locally on 3.11.0 |
| Web framework | FastAPI | `==0.111.0` (requirements.txt). Probe ran on 0.115.0, behavior consistent |
| ASGI server | uvicorn[standard] | `==0.29.0` |
| ORM | SQLAlchemy | `==2.0.30` (DeclarativeBase style) |
| DB driver | psycopg2-binary | `==2.9.9` (PostgreSQL) |
| Validation | pydantic | `==2.7.1` |
| LLM SDK | openai (AsyncOpenAI pointed at OpenRouter) | `>=1.30.0` |
| Env | python-dotenv | `==1.0.1` |
| Listed, unused | sse-starlette | `==2.1.0` (SSE is hand-rolled with `StreamingResponse`) |
| Frontend framework | Next.js (App Router) | `16.2.4` (exact) |
| UI runtime | React / React DOM | `19.2.4` (exact) |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` | `^4` (installed 4.2.4) |
| Language | TypeScript | `^5`, `strict: true`, path alias `@/* → ./*` |
| Lint | ESLint 9 + `eslint-config-next` 16.2.4 (core-web-vitals + typescript) | |
| Listed, **unused** deps | `@radix-ui/react-dialog` 1.1.15, `@radix-ui/react-tabs`, `lucide-react` 1.14.0, `react-markdown` 10.1.0 | no imports anywhere [CODE, grep] |
| Package manager | npm (`package-lock.json`) | npm 11 locally |
| Dev runner | `concurrently` | `^8.2.2` |

> `frontend/AGENTS.md` warns: *"This is NOT the Next.js you know — this version has breaking changes… Read the relevant guide in `node_modules/next/dist/docs/`"*. Codex should do the same if it uses Next 16.

---

## 4. Pricing Agent Architecture Diagram

```mermaid
flowchart LR
  subgraph Browser["Browser (Next.js 16 client components)"]
    L["/ Login"] --> D["/dashboard SKU Explorer"]
    D --> PL["/projects list"]
    D --> NP["/projects/new"]
    PL --> PW["/projects/:id Workspace"]
    NP --> PW
    PW --> NG["/projects/:id/negotiate"]
    LS[("localStorage<br/>pricemind_user<br/>negotiate_chat_:id")]
    SS[("sessionStorage<br/>negotiate_:id")]
    CTX["Providers: AuthContext + NotifContext (in-memory)"]
  end

  subgraph API["FastAPI backend (uvicorn, CORS *)"]
    R["REST routes /api/*"]
    SSE1["GET committee/stream (SSE)"]
    SSE2["GET executor/stream (SSE)"]
    SSE3["POST negotiate (SSE-formatted stream)"]
    ENG["data_loader: compute_ds_predictions / compute_preview"]
    PR["agents/prompts.py"]
  end

  JSON[("sku_data.json<br/>in-memory cache")]
  DB[("PostgreSQL / SQLite<br/>projects, project_skus,<br/>review_decisions, pricing_history")]
  OR["Configured LLM API<br/>Codex-assisted development"]

  Browser -- "fetch JSON (NEXT_PUBLIC_API_URL)" --> R
  PW -- "EventSource" --> SSE1
  PW -- "EventSource" --> SSE2
  PW -- "fetch + ReadableStream" --> SSE3
  NG -- "fetch + ReadableStream POST /api/negotiate" --> SSE3
  R --> ENG --> JSON
  R --> DB
  SSE1 --> PR --> OR
  SSE2 --> OR
  SSE3 --> OR
  SSE1 --> DB
  SSE2 --> DB
```

Communication patterns:
- **REST JSON** through plain `fetch` (no auth headers, no credentials).
- **SSE through `EventSource`** for the committee and executor (GET).
- **SSE-formatted streamed POST** read with `response.body.getReader()` for negotiation.

---

## 5. Pricing Agent Routes and Navigation

### 5.1 Frontend route table

All pages are `"use client"` components. No middleware. No server components except `layout.tsx`.

| Route | File | Guard | Linked from | Purpose |
|---|---|---|---|---|
| `/` | `app/page.tsx` | none | Sign out, guard redirects | Org-picker login |
| `/dashboard` | `app/dashboard/page.tsx` | client guard* | Navbar logo, "SKU Explorer" | SKU Explorer + quick-create modal |
| `/projects` | `app/projects/page.tsx` | client guard* | Navbar "Pricing Projects", back links | Project list, edit/delete |
| `/projects/new` | `app/projects/new/page.tsx` | client guard* | "+ New Project" (dashboard, projects list, empty state) | Full project creation |
| `/projects/[id]` | `app/projects/[id]/page.tsx` | client guard* | project cards, SKU "Project" badges, post-create redirect | Lifecycle workspace |
| `/projects/[id]/negotiate` | `app/projects/[id]/negotiate/page.tsx` | client guard* | "Full Analysis ↗" button in the inline chat | Full negotiation |
| `/settings` | `app/settings/page.tsx` | client guard* | Navbar ⚙ icon, user dropdown "Settings" | Rule Engine + Autonomy tabs |
| `/admin` | `app/admin/page.tsx` | client guard* | Navbar shield icon, user dropdown "Admin Console" | User mgmt + System info |
| `/rules` | `app/rules/page.tsx` | client guard* | **none** | Orphaned duplicate |
| `/autonomy` | `app/autonomy/page.tsx` | client guard* | **none** | Orphaned duplicate |

\* **Client guard** = `useEffect(() => { if (!user) router.push("/"); }, [user]);`. `user` comes from `AuthContext`, which is populated **in an effect** in `Providers` from localStorage. React runs child effects before parent effects, so on a hard refresh or a deep link the page sees `user === null` on its first effect and **redirects to `/`**, even when a user is stored. **[INFERRED from React effect ordering; not verified in a browser.]** The login page does not auto-redirect logged-in users. To reproduce this faithfully, keep the same guard pattern.

### 5.2 Navigation flow

```mermaid
flowchart TD
  A["/ (login)"] -- "Sign In → (600 ms delay)" --> B["/dashboard"]
  B -- "+ New Project" --> C["/projects/new"]
  B -- "select SKUs → Create Pricing Project → Launch" --> E["/projects/:id"]
  B -- "click locked SKU's project badge" --> E
  C -- "Create & Launch" --> E
  C -- "← Projects" --> D["/projects"]
  D -- "card click / Open →" --> E
  D -- "+ New Project / → Create your first project" --> C
  E -- "← Projects / × close" --> D
  E -- "Full Analysis ↗" --> F["/projects/:id/negotiate"]
  F -- "← Back to Project" --> E
  N["Navbar (all pages except / )"] --> B & D & G["/settings"] & H["/admin"]
  N -- "Sign out" --> A
```

There is no browser-history state preservation beyond Next's default. No query strings are used. The only URL parameter is `[id]`.

---

## 6. UI/UX and Design System

### 6.1 Global foundations [CODE]

`app/layout.tsx`:
- `<html lang="en" className="h-full">`
- `<body className="min-h-full bg-gray-950 text-gray-100 antialiased"><Providers>{children}</Providers></body>`
- Metadata: title **"PriceMind AI — Agentic Pricing Committee"**, description **"AI-powered list price optimization platform"**.

`app/globals.css` (copy this file exactly):

```css
@import "tailwindcss";
:root { --background: #030712; --foreground: #f9fafb; }
body { background: var(--background); color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #111827; }
::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
.agent-output h1, .agent-output h2 { font-size: 1rem; font-weight: 700; margin-top: 0.75rem; }
.agent-output strong { color: #fbbf24; }
.agent-output table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; font-size: 0.78rem; }
.agent-output th { background: #1f2937; padding: 4px 8px; text-align: left; border: 1px solid #374151; }
.agent-output td { padding: 3px 8px; border: 1px solid #374151; }
.agent-output code { background: #1f2937; padding: 1px 4px; border-radius: 3px; font-size: 0.8rem; }
.agent-output ul { list-style: disc; padding-left: 1.2rem; }
.agent-output li { margin: 2px 0; }
```

> The `.agent-output` classes are **never applied** in the current JSX; agent text renders as pre-wrapped monospace plain text. Keep them anyway for parity.

**Theme.** Dark only. There is no light theme and no toggle. There is no custom Tailwind config, so the design system is **stock Tailwind v4 defaults**. Tailwind v4 defines its default palette in OKLCH; the hex values below are the familiar sRGB equivalents for reference. Use Tailwind v4 classes to get identical output.

**Typography.** System font stack (above), plus Tailwind `font-mono` for SKU IDs, agent output, and tool calls. No web fonts and no image assets: logos are gradient boxes with letters, and icons are emoji or inline SVG paths.

### 6.2 Color roles (Tailwind tokens used)

| Role | Classes | Approx. hex |
|---|---|---|
| Page background | `bg-gray-950` / `#030712` | #030712 |
| Card surface | `bg-gray-900` | #111827 |
| Raised / input surface | `bg-gray-800` | #1f2937 |
| Borders | `border-gray-800` (cards), `border-gray-700` (inputs/modals) | #1f2937 / #374151 |
| Primary text / secondary / muted | `text-white`, `text-gray-300/400`, `text-gray-500/600/700` | |
| Primary action | `bg-blue-600 hover:bg-blue-500` | #2563eb / #3b82f6 |
| Brand gradient (logo, launch CTA) | `bg-gradient-to-br from-blue-500 to-purple-600`; CTA `bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500` | |
| SKU ID | `text-blue-400 font-mono` | #60a5fa |
| Success / positive | `text-green-400`, `bg-green-600` (Submit), `bg-green-900/xx` | |
| Warning / low margin | `text-amber-400`, `bg-amber-900/20..40` | #fbbf24 |
| Danger / overdue | `text-red-400`, `bg-red-600/700` (destructive buttons) | |
| Locked SKU | `orange-*` (`bg-orange-950/10`, badge `bg-orange-900/30 text-orange-300 border-orange-700/40`) | |
| Negotiation | `purple-*` (`bg-purple-600` send button, `border-purple-700/40`) | |
| Planner / summary | `indigo-*` | |
| Critic | `yellow-*` | |
| Executor | `green-*` | |

Agent panel theming (`AGENT_META`):

| Agent | Icon | Label | Sublabel | Active border | Header bg | Header text |
|---|---|---|---|---|---|---|
| planner | 📋 | Planner Agent | Blueprint Phase | `border-indigo-600` | `bg-indigo-900/40` | `text-indigo-200` |
| builder | ⚙️ | Builder Agent | Pricing Engine | `border-blue-600` | `bg-blue-900/40` | `text-blue-200` |
| critic | 🔍 | Critic Agent | Guardrail Check | `border-yellow-600` | `bg-yellow-900/30` | `text-yellow-200` |
| executor | ✅ | Executor Agent | Apply & Route | `border-green-600` | `bg-green-900/30` | `text-green-200` |

Guardrail flag chips (`FLAG_STYLE`):
- Hard Block: `bg-red-900/40 text-red-300 border-red-700/60`
- Soft Warn: `bg-amber-900/30 text-amber-300 border-amber-700/40`
- Info: `bg-blue-900/20 text-blue-300 border-blue-700/30`

Tool-call category chips:
- Data Fetch: `bg-blue-900/50 text-blue-300 border-blue-700/50`
- Pipeline Run: `bg-purple-900/50 text-purple-300 border-purple-700/50`
- Model Run: `bg-green-900/50 text-green-300 border-green-700/50`

Trend chips (dashboard):
- Growing: `text-green-400 bg-green-900/30 border-green-800`
- Stable: `text-blue-400 bg-blue-900/30 border-blue-800`
- Declining: `text-red-400 bg-red-900/30 border-red-800`

### 6.3 Component patterns (reuse these class recipes)

| Pattern | Classes |
|---|---|
| Card | `bg-gray-900 border border-gray-800 rounded-xl` (`rounded-2xl` for big panels), padding `p-4`/`p-5` |
| Text input / select | `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 (or py-2.5) text-white text-sm focus:outline-none focus:border-blue-500` (+ `placeholder-gray-600`); date inputs add `[color-scheme:dark]`; error state `border-red-500` |
| Primary button | `bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors` ; disabled `disabled:opacity-40` (or 50) |
| Secondary button | `bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium` |
| Destructive button | `bg-red-700 hover:bg-red-600` or `bg-red-600 hover:bg-red-500` |
| Pill/badge | `text-xs px-2(.5) py-0.5(1) rounded-full border font-medium` |
| Modal overlay | `fixed inset-0 bg-black/70 (backdrop-blur-sm) flex items-center justify-center z-50 (p-4)`; dialog `bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg/md/2xl shadow-2xl` |
| Table head | sticky `top-0 z-10`, `bg-gray-800 text-gray-400 text-xs uppercase tracking-wide`, cells `p-2.5`/`p-3` |
| Table rows | `border-t border-gray-800`, hover `hover:bg-gray-800/40` |
| Section divider (workspace phases) | label `text-[10px] font-bold text-gray-600 uppercase tracking-widest` + title `text-sm font-bold text-white` + hint `text-[10px] text-gray-600` + `flex-1 h-px bg-gray-800` rule |
| Collapsible chevron | inline SVG `M19 9l-7 7-7-7`, `transition-transform`, `rotate-180` when expanded (group rows use `M9 5l7 7-7 7` + `rotate-90`) |

**Motion.** Tailwind `animate-pulse` (status dots, skeletons, streaming cursor `▋`), `animate-spin` (⚙️ emoji spinners), `transition-colors`/`transition-all`/`transition-transform`, `duration-300` on agent panel borders. No custom keyframes.

**Containers / breakpoints.** Navbar `max-w-7xl mx-auto px-4 h-14`. Dashboard and workspace use `max-w-7xl`; new project uses `max-w-6xl`; projects list and admin use `max-w-5xl`; settings uses `max-w-6xl`. Breakpoints are Tailwind defaults: `sm` 640px, `lg` 1024px. Tables scroll inside `overflow-auto` containers with max heights.

---

## 7. Screen-by-Screen Specifications

Every screen except `/` renders `<Navbar/>` first. Copy all literal strings (including emoji) exactly.

### 7.0 Navbar (`components/Navbar.tsx`)

- `<nav className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-50">`, inner `max-w-7xl mx-auto px-4 h-14 flex items-center gap-4`.
- **Logo** (Link `/dashboard`): a 28×28 `rounded-lg` gradient box with a white "P" (`text-xs font-bold`), then **"PriceMind"** with **"AI"** in `text-blue-400`.
- **Brand badge** (only if user, hidden below `sm`): `user.brand` in a gray pill.
- **Nav links:** "SKU Explorer" → `/dashboard`, "Pricing Projects" → `/projects`. Active when `pathname.startsWith(href)`: `bg-gray-800 text-white`. Otherwise `text-gray-400 hover:text-white hover:bg-gray-800/50`.
- **Right cluster** (`ml-auto`):
  - "Agents Ready" with a pulsing green dot (hidden below `sm`).
  - Settings gear icon link `/settings` (title "Settings").
  - Shield-check icon link `/admin` (title "Admin Console").
  - **Notification bell:** red badge with the unread count (`9+` when over 9). Clicking toggles a dropdown (`w-80`) headed "Notifications" with a "Mark all read" link. Items show an emoji by type (alert 🔴, warning 🟡, info 🔵, success 🟢), title, body, and time. Read items render at `opacity-60`; unread items get `bg-gray-800/30`. List `max-h-80 overflow-y-auto`.
  - **User dropdown** (if user): a gradient avatar circle showing `user.avatar`, then name/role (hidden below `sm`) and a chevron. The menu (`w-52`) shows name and brand, then "Settings", "Admin Console", and "Sign out" (red). Sign out calls `logout()` then `router.push("/")`.
  - Opening one dropdown closes the other. A transparent `fixed inset-0 z-40` backdrop closes both when clicked.
- No keyboard/Escape handling. No mobile hamburger; links just stay inline.

### 7.1 `/` Login (`app/page.tsx`)

- **Layout:** full-screen centered column on `bg-gray-950`, with a decorative absolute overlay `bg-gradient-to-br from-blue-950/20 via-gray-950 to-purple-950/10`. Content `max-w-md`.
- **Header:** a 40×40 `rounded-xl` gradient "P" box, then **"PriceMind AI"** (`text-2xl font-bold`, "AI" blue). Subtitle "Agentic Pricing Committee Platform".
- **Card** (`bg-gray-900 border-gray-800 rounded-2xl p-8`): "Welcome back" / "Select your organization to continue".
- **Three org buttons**, single-select:

| Brand | Logo text | Gradient | Tagline |
|---|---|---|---|
| Assa Abloy | AA | `from-blue-600 to-blue-800` | Door Hardware & Electronic Security |
| Novartis | NV | `from-red-600 to-red-800` | Pharmaceuticals & Healthcare |
| Schneider Electric | SE | `from-green-600 to-green-800` | Energy Management & Automation |

  Selected: `border-2 border-blue-500 bg-blue-950/30` plus a blue dot on the right. Unselected: `border-gray-700 hover:border-gray-600 bg-gray-800/50`.
- **Info strip:** "Logging in as: **admin**" with a "Pricing Admin" pill.
- **Button:** "Sign In →". Disabled until an org is selected. While loading it reads "Signing in…". `setTimeout(600)` → `login(BRAND_USERS[brand])` → `router.push("/dashboard")`.
- **Footer:** "PriceMind AI · Powered by Agentic AI · Demo Environment".
- **Every brand sees the same 28 SKUs.** The brand only changes labels.

`BRAND_USERS`: `{ name: "Admin", role: "Pricing Admin", brand, avatar: "AA" | "NV" | "SE" }`.

### 7.2 `/dashboard` SKU Explorer

**On mount:** `fetchSkus()` and `fetchSkuAssignments()` run in parallel. If assignments fail, an empty map is used. If SKUs fail, nothing is caught. There is no loading state; the table is simply empty.

**Regions, top to bottom:**
1. **Header:** "SKU Explorer" (`text-xl font-bold`). Subtitle `"{brand} · {n} SKUs loaded · Select to build a pricing project"`. Right side: "+ New Project" → `/projects/new`.
2. **Macro panel** (collapsible, collapsed by default):
   - Header button with `bg-amber-950/20`: "📡 Macro Cost Signals", then "Composite pressure: **+4.8%** · Mar-25".
   - When collapsed, it also shows the first 4 signals inline plus "+4 more…".
   - When expanded, a grid (`grid-cols-2 sm:grid-cols-4`) of 8 tiles shows the label, an amber value, and "Relevant: …". The data is hard-coded:

| Label | Value | Relevant |
|---|---|---|
| CPI (YoY) | +3.2% | All categories |
| PPI Metals | +4.8% | Door Hardware |
| Steel Index | +6.1% | Deadlatches / Deadbolts |
| Zinc Spot | +2.9% | Deadbolts |
| Freight | +5.4% | All categories |
| Copper | +3.8% | Electronic Security |
| Energy | +2.6% | Industrial / OEM |
| USD/INR | +1.8% | Import cost |

3. **Hierarchy filters** card: "FILTER BY HIERARCHY". Four selects (`grid-cols-1 sm:grid-cols-4`): Business Group, Brand, Category, Sub-Category. Each lists `"All"` plus the unique values, **cascading**: options are computed from SKUs matching the upstream filters. Changing a filter resets the downstream filters to "All" **and clears the selection**.
4. **Selection bar** (when 1+ selected): `"{n} SKU(s) selected"` and the button "🚀 Create Pricing Project" (opens the modal).
5. **Tabs row:** "Pricing" | "Sales & Volume" | "Channel & Customer". Active tab: `bg-gray-700 text-white`. On the right:
   - If any visible SKU is locked, a toggle "🔒 Show available only" ↔ "✓ Available only".
   - The text `"{visible} SKUs · Total 12mo Rev: ${sum(revenue_12mo)/1e6 to 1 dp}M"`.
6. **Locked notice** (if locked SKUs are in view): "🔒 **N SKU(s) in this view** are greyed out — already part of an active pricing project and cannot be selected. Click the project badge in the **Project** column to open that project."
7. **Table:** `overflow-auto max-h-[calc(100vh-340px)]`, sticky header.
   - Header checkbox = select/deselect all *selectable visible* rows.
   - Common columns: ☐ | SKU (mono blue) | Product (truncate 160px) | Brand | Sub-Category | Project.
   - The Project column shows a clickable blue pill with the project name (→ `/projects/{project_id}`) for locked SKUs, otherwise "—".
   - **Pricing tab** columns:
     - List Price: `$` with 2 decimals, `toLocaleString`.
     - Unit Cost.
     - Margin: `(m*100).toFixed(1)%`, amber if `< 0.22`, else green.
     - Realization: amber if `< 0.85`.
     - Last Reprice: `last_price_change` string.
     - Mo Since: `{n}mo`, red if `> 12`.
     - Trend chip.
   - **Sales tab** columns: Avg Units/Mo, YTD Units (locale formatted), YTD Revenue `$(v/1000).toFixed(0)K`, 12mo Revenue (same format), Trend.
   - **Channel tab** columns: Channel, Customer Segment, Type chip (Configured = purple, else gray), Trend.
   - **Rows:** clicking toggles selection. Locked rows show `opacity-50 cursor-not-allowed` with a disabled checkbox. Selected rows get `bg-blue-900/20`. Odd rows get `bg-gray-900/40`.
8. **Create modal:**
   - Title "Create Pricing Project". Subtitle `"{n} SKUs selected · Agentic Committee will be assigned"`.
   - Fields (all required, marked with a red *):
     - Project Name (placeholder "e.g. Residential Q3 2025 Repricing").
     - Revenue Target ($ prefix, number, min 0, step 100, placeholder "e.g. 250000").
     - Start Date (default today in UTC `YYYY-MM-DD`, `min=today`).
     - Review By (`min=start||today`).
   - Date validation runs on every change (§11.6). The error shows below the fields, and only the Review By input gets the red border.
   - Selected SKU chips appear in a `max-h-24` scroll area.
   - Buttons: "Cancel" (resets all modal fields) and "🚀 Launch". Launch is disabled when name, target, or either date is missing, when there's a date error, or while creating. It reads "Creating…" while creating.
   - On success: `router.push("/projects/{id}")`. **On API error the code has no try/catch**: the promise rejects, the button stays "Creating…", and nothing else is shown.

### 7.3 `/projects/new` New Pricing Project

- **Breadcrumb header:** "← Projects" (→ `/projects`) / "New Pricing Project".
- **Layout:** `grid grid-cols-1 lg:grid-cols-3 gap-6`. The left side spans 2 columns.
- **Left: filter card** "Select SKUs by Criteria":
  - The same four cascading selects in `grid-cols-2`. Changing a filter does **not** clear the selection here, unlike the dashboard.
  - Action: "Select all {availableCount} available SKUs" (replaces the selection with all *unlocked filtered* SKUs). Disabled while assignments load or when the count is 0.
  - "Clear selection" appears when anything is selected.
- **Left: table card:**
  - Meta row: `"{available} available"`, then one of:
    - "Checking assignments…" (pulsing dot) while loading.
    - "🔒 {n} locked to other project(s)" in orange.
  - Plus `"· {n} selected"`.
  - Table `max-h-[480px]` with columns: ☐/🔒 | SKU | Product | Sub-Cat | Project | List Price | Margin | Trend | Mo Since.
  - **Sorting:** available SKUs first, locked SKUs at the bottom (stable within each group).
  - Locked rows: `bg-orange-950/10 cursor-not-allowed`, all text dimmed, a lock icon instead of the checkbox, an orange badge "🔒 {project_name}", and the tooltip `Locked — part of "{name}"`.
  - Selected rows: `bg-blue-900/20`.
  - Margin amber if `< 0.22`; trend chips; Mo Since red and bold if `> 12`.
  - Empty state: "No SKUs match the selected filters".
  - Toggle is ignored while assignments are loading.
  - When assignments arrive, any already-selected SKUs that turn out to be locked are removed from the selection.
- **Right: sticky** (`top-20`) "Project Details" card:
  - Project Name * (placeholder "e.g. Q3 Door Hardware Repricing").
  - Revenue Target * ($, same constraints).
  - Start Date * (`min=today`, default today).
  - Review By * (`min=start||today`).
  - Error text in `text-red-400 text-xs`. The red border goes to the input whose error message contains "Start" or "Review".
  - "Selected SKUs ({n})" chips, each with a × button to remove it. Empty: italic "No SKUs selected yet".
  - Info box:
    - "Agents: Planner · Builder · Critic · Executor"
    - "DS Model: DemandModel-v2.1"
    - "Est. time: ~3–5 min"
  - API error box: `⚠ {detail}` in a red box (e.g. the 409 conflict message).
  - **CTA:** full-width gradient button.
    - Label: `"⚡ Create & Launch"`, plus `" ({n} SKUs)"` when n > 0. Reads "Creating…" while creating and "Loading…" while assignments load.
    - Disabled when any field is missing, there's a date error, assignments are loading, or a create is in flight.
  - Success → `/projects/{id}`. "Launch" does **not** auto-start the agents; the user still clicks Run Agents.

### 7.4 `/projects` Pricing Projects

- **Header:** "Pricing Projects" (`text-2xl`) / "Agentic committee drives each project from blueprint to approved prices". Right: "+ New Project" link.
- **Filter tabs** with counts: All | Pending | In Progress | Complete. Statuses map through `displayStatus`:
  - `running`, `review_complete`, `executing`, `approved` → "In Progress".
  - `complete` → "Complete".
  - Anything else → "Pending".
- **Loading:** 3 pulsing skeleton cards.
- **Empty:**
  - 📋 plus "No projects yet" and a "→ Create your first project" link, or
  - "No projects match this filter".
- **Card** (whole card is a Link to `/projects/{id}`, `group` hover):
  - Name (turns blue on hover) and a status pill with a dot. Pill styles come from `STATUS_META` keyed by the *raw* status:
    - pending: gray.
    - running / executing: blue with a pulsing dot.
    - review_complete: amber with a pulsing dot.
    - approved: amber.
    - complete: green.
  - Complete projects also show "✅ All SKUs priced".
  - Meta line:
    - `{n} SKUs`.
    - `Target: ${target/1000 to 0 dp}K uplift` (only if target is non-zero).
    - `Start: {date}`.
    - `Review by: {date}` (green when complete, amber otherwise).
  - Right side: "✏️ Edit" and "🗑 Delete" buttons, visible only on hover (`opacity-0 group-hover:opacity-100`). Both call `preventDefault` and `stopPropagation`. Also an "Open →" label.
  - The first 10 SKU-ID chips, then "+{n} more".
- **Order:** backend order is `created_at DESC`.
- **Edit modal** (`max-w-2xl`, scrollable overlay):
  - Fields:
    - Project Name.
    - Revenue Target (hint: "Delta vs Target and realization metrics recalculate automatically when the project is next opened.").
    - Start Date (no `min`).
    - Review By (`min=start||today`).
  - Date check: only `end <= start` gives "Review date must be after the start date.".
  - **Manage SKUs** collapsible:
    - Header pill `"{n} selected"`, plus "· changed" in amber when the set differs from the original.
    - On first expand, it lazy-loads `fetchSkus` and `fetchSkuAssignments` together, showing "Loading SKUs…".
    - Selected chips (click to remove; hover turns them red).
    - Counts: `"{available} available"` and `"🔒 {locked} locked to other projects"`, where locked means assigned to a *different* project.
    - Search box "Search SKU / product / brand…" matches `sku_id`, `product_name`, `brand`, `category`, and `sub_category` (case-insensitive substring).
    - Table `max-h-60` with columns ☐ | SKU | Product | Brand · Category | Status. Status is one of "🔒 {name}" / "✓ Selected" / "Available". Locked rows are disabled.
    - Empty search result: "No SKUs match your search".
  - **SKU-change warning** (amber box): "**SKU changes will reset pricing** — All agent outputs, review decisions, and execution history will be cleared. The project returns to **Pending** and pricing must be re-initiated."
  - **Save button:** "Save Changes" (blue), or "Save & Reset Pricing" (amber) when SKUs changed. Reads "Saving…" while saving. Disabled while saving, when the name is empty, when 0 SKUs are selected, or when there's an error. Zero SKUs on save also shows "At least one SKU must be selected.".
  - **Request:** `name: trimmed || original`; `target_revenue: parseFloat` or omitted if blank; `start_date`/`end_date` omitted if blank; `sku_ids` only when changed.
  - On success the card is merged in place: `{...p, ...updated}`. The updated `skus` come back from the server.
  - Errors show inline (e.g. the 409 message).
- **Delete modal** (`max-w-md`):
  - 🗑 icon. Title "Delete project?". Text: "**{name}** and all its pricing data will be permanently removed. Its SKUs will become available for other projects."
  - Buttons "Cancel" and "Delete Project" (reads "Deleting…"; both disabled while deleting).
  - Success removes the card; errors show inline.

### 7.5 `/projects/[id]` Project Workspace (core screen)

#### 7.5.1 Client phase state machine [CODE]

```mermaid
stateDiagram-v2
  [*] --> idle : load (status pending, or running w/o outputs)
  [*] --> awaiting_review : load (review_complete | executing | approved | running+outputs)
  [*] --> complete : load (status complete)
  idle --> committee_running : Run Agents
  committee_running --> awaiting_review : critic done / phase event
  committee_running --> idle : Stop Agents / SSE error
  idle --> awaiting_review : Price Manually
  awaiting_review --> executor_running : Submit for Execution
  executor_running --> complete : executor done
  executor_running --> awaiting_review : executor SSE error
  awaiting_review --> idle : Re-run Agents (reset)
  awaiting_review --> committee_running : Run Agents (manual mode: reset + launch)
  complete --> idle : Reopen for Pricing (reset)
  complete --> awaiting_review : Price Manually (reset)
```

`isManualMode` (boolean) is set by Price Manually. It changes the awaiting_review header button from "↺ Re-run Agents" to "⚡ Run Agents".

#### 7.5.2 Initial load sequence

1. `fetchMacro()` → `macroData` (errors ignored).
2. Chat history is restored from `localStorage["negotiate_chat_{id}"]`.
3. `fetchProject(id)` → `project`:
   - If `narrative_summary` is present → show the summary.
   - If any of planner/builder/critic output is present → fill the agent texts and collapse all panels.
   - If `executor_output` is present → executor text.
   - Phase is restored from status:
     - `complete` → `restorePreview("complete")`.
     - `review_complete` / `executing` / `approved` → `restorePreview("awaiting_review")`.
     - `running` with any output or summary → `restorePreview("awaiting_review")`. This is the "stalled SSE" path.
     - `running` without outputs → `idle`.
     - `pending` → `idle`.
   - `restorePreview(phase)`:
     - Sets the phase and `negotiationStep = "grid"`.
     - Fetches the preview.
     - Expands all groups.
     - Turns `project.review_decisions` into `overrides` (as strings), so the grid shows the approved values.
4. While `project` is null, the screen shows only "Loading…" centered, with no navbar. A 404 response still sets `project` to `{detail:…}`. **[INFERRED]** The page then renders with an undefined name.

#### 7.5.3 Layout (top to bottom)

**A. Stop warning modal** (when `stopWarning`):
- ⚠️ icon, title "Stop Agents?".
- Text: "This will terminate the current agent run immediately. All in-progress outputs will be discarded and the project will return to its initial state. This cannot be undone."
- Buttons "Cancel" and "Stop Agents" (red).

**B. Header:**
- "← Projects" link, then the H1 project name (`text-2xl`).
- Meta line:
  - `{n} SKUs in scope`.
  - `· Start: {start}`.
  - `· Review by: {end}` (amber).
  - `· Committee last run: {new Date(iso).toLocaleString()}` (indigo).
- Right-side actions depend on the phase:

| Phase | Controls |
|---|---|
| idle | Gradient "⚡ Run Agents" (or "⚡ Re-run Agents" if `committee_last_run` or any agent text) + "✏️ Price Manually" (title "Skip AI analysis — enter price changes manually") |
| committee_running | Blue pill "⚙️ Agents running…" (spinning) + red "⏹ Stop Agents" (opens modal) |
| awaiting_review / executor_running / complete | Green pill "✅ Analysis Ready" ("✅ Prices Applied" when complete) |
| awaiting_review | + "⚡ Run Agents" (manual mode) or "↺ Re-run Agents" |
| complete | + "✏️ Price Manually" (title "Re-price manually without running agents") + "↺ Reopen for Pricing" |
| always | "×" square button → `/projects` (title "Close project") |

**C. KPI tiles** (only when preview data exists). Grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-{count}`. Each tile is a centered value (`text-xl font-bold`), a label, and a sub-label. `fmtK(v) = v>=1e6 ? "$"+(v/1e6).toFixed(1)+"M" : "$"+(v/1000).toFixed(0)+"K"`.

| Tile | Value | Color | Sub |
|---|---|---|---|
| Revenue Target | `fmtK(target)` or "—" if 0 | gray-300 | project goal |
| Expected Uplift | `fmtK(portfolio.revenue_uplift)` | blue-400 | 12-mo estimate |
| Delta vs Target *(only if target>0)* | `(Δ>=0?"+":"") + fmtK(uplift − target)` | green if ≥0 else red | "above target ✓" / "below target" |
| Avg Increase | `avg_proposed_pct.toFixed(1)%` | blue-300 | across all SKUs |
| Net Realization | `(expected_realization*100).toFixed(1)%` | green if ≥0.85 else amber | list-to-net rate |
| Guardrail Issues | `"{skus_with_hard_block} blocks"` | red if >0 else green | `"{skus_with_warnings} warnings"` |

> Note: `fmtK` of a negative delta prints e.g. `$-152K` (the `+` is only added for non-negative values). `lg:grid-cols-5/6` is built dynamically; whether Tailwind generates it is **[UNVERIFIED]**. If it doesn't, the grid stays at 3 columns on large screens.

> **The KPIs and grid always reflect the deterministic proposal, not the user's overrides.** The KPIs do not recompute when overrides change.

**D. Section "PHASE 1 · ⚡ Agentic Pricing · Agents analyse · summarise · recommend".**

**E. Ambient Agents card** (always visible):
- Header "AMBIENT AGENTS" plus "Always-on monitoring". When preview rows exist, an indigo pill on the right reads "Signals tuned to: {mixLabel}".
- **Market & Cost Signal Agent** (📡, green "Live" badge):
  - Subtitle: "Input cost signals · tuned for {mixLabel}", or "Input cost signals · CPI, metals, freight, forex" before rows exist.
  - Four signal bars. Each row: label (right-aligned, `w-11`), a bar track, the value `+X.X%`, and a severity tag:
    - HIGH when `>5`, MED when `>3`, LOW when `>0`.
    - Bar color red / amber / green to match.
    - Bar width `min(pct*12, 100)%`.
  - Before macro data loads: placeholder rows CPI / Steel / Freight / Forex with pulsing bars and "—".
  - Optional alert line `⚠ {alert}` (§11.7).
- **Sales & Demand Monitor Agent** (📊, "Live"). Subtitle "Order volumes · churn · DS model health · drift". 2×2 tiles:
  - Order Volume: **Stable** / "No significant shift" (static).
  - Customer Churn: **None detected** / "Post-price-action risk" (static).
  - DS Model Accuracy: average preview confidence ×100 to 1 dp.
    - Green "Well calibrated" when ≥0.85.
    - Blue "Acceptable" when ≥0.70.
    - Amber "Needs attention" otherwise.
    - Before rows exist: "Run agents" / "Computed per-SKU".
  - Prediction Drift: **None** / "Model vs actuals OK" (static).

**F. Pre-launch placeholder** (phase idle and no agent text):
- 🏛️ plus "Active Agent Committee".
- Paragraph: "Three active agents collaborate when launched — Reasoning & Gatekeeper creates the blueprint, Pricing Engine runs the pipeline with live tool calls, and Critic enforces guardrails. Alternatively, skip the committee and enter price changes manually."
- A row of the 3 agent icons with label and sublabel.

**G. Committee agent panels** (when `hasCommitteeOutput`):

`hasCommitteeOutput` is true when **any** of these holds: any agent text is non-empty, phase is committee_running, `committee_last_run` is set, phase is complete, or phase is awaiting_review.
- One collapsible panel per agent (planner, builder, critic).
  - Border: `border-2`, with the agent's color and `shadow-lg` while active, otherwise `border-gray-800`.
  - Header: icon, label, sublabel.
  - Right side of the header shows one of:
    - "Analyzing…" (pulsing dot) while active.
    - "✓ Done" when it has text.
    - "Waiting…" when empty.
  - Chevron.
- **Builder only:** a tool-call sub-panel.
  - Toggle header: "⚡ Tool Calls · Pipeline Runs · Model Runs ({n} executed)".
  - Each call shows ✓, a category chip, the name, args `k=JSON(v)` joined with ", " (truncated at 260px), and on the next line `→ k: JSON(v) · …` (excluding `status`) plus "OK".
  - While the builder is active and fewer than 5 calls have arrived: "Running next tool…" (pulsing).
- **Body:** `p-4 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto`.
  - Empty: "Waiting for prior agent…" (italic).
  - Active: a blinking `▋` cursor.
  - Auto-scrolls to the bottom on each chunk.
  - The text is **plain text, not rendered markdown**.

**H. Price Increase Summary** (when the summary is loading or present). Indigo card, collapsible.
- Header:
  - "📊 Price Increase Summary".
  - While loading: "Generating…" (pulsing).
  - Once loaded: "click to collapse/expand".
- Body:
  - When preview rows exist, three tiles:
    - **DS MODEL:** average `ds_base_pct`. Tooltip ℹ: "Derived from the Data Science pricing model: demand elasticity analysis, margin targets, competitive positioning, months-since-reprice scoring, and SKU trend data. This is the model's base recommendation before any external adjustment."
    - **MACRO Δ:** `+` average `macro_delta_pct`. Tooltip: "External delta added on top of the DS model. Reflects real-time macro cost signals monitored by the ambient agent: CPI, commodity indices (steel, plastics), freight rates, and forex shifts. These are external parameters not baked into the base DS model."
    - **TOTAL PROPOSED:** sum of the two averages. Tooltip: "DS Model base + Macro Δ = Committee-recommended price increase. This is the value shown in the Proposed % column of the grid below. You can override per-SKU or per-group in Negotiation Mode."
  - Then the narrative text (`whitespace-pre-wrap`). While loading: "Summarising planner, builder and critic outputs…".

**I. Section "PHASE 2 · 💬 Negotiation Mode"**:
- Shown when phase ∈ {awaiting_review, executor_running, complete} **or** `hasCommitteeOutput`.
- Hint: "Ask questions · challenge assumptions · then proceed to override grid" when the chat is open in awaiting_review; otherwise "Review agent recommendations · override per SKU or group".
- When the chat is closed: a purple "💬 Open Negotiation Chat" button.

**J. Inline negotiation chat** (`hasCommitteeOutput && negotiationStep==="chat"`). Purple-bordered card, `max-h-[520px]` flex column.
- **Header:**
  - 🤝 "Negotiate with Agents" / "Challenge the recommendations — override grid is always visible below".
  - Buttons "Full Analysis ↗" (→ `/projects/{id}/negotiate`) and "✕ Close Chat".
  - Below: "SKUs in scope:" followed by mono chips with the product name as the title tooltip.
- **Messages:**
  - User messages: right-aligned `bg-blue-600`, `rounded-br-sm`.
  - Assistant messages: left-aligned `bg-gray-800 border-gray-700`, `rounded-bl-sm`, labeled "Pricing Agent" in purple. Empty content shows a pulsing `▋`.
  - Auto-scrolls smoothly to the end.
- **Empty state:**
  - 💬 plus "Ask the pricing agent to justify a recommendation, explore a cap scenario, or understand what's driving the increase."
  - Four suggestion buttons. Clicking one fills the input; it does not send.
    - "Why was this increase % chosen?"
    - "What if we cap Residential at 3%?"
    - "Explain the DS model vs macro split"
    - "Which SKUs have the highest risk?"
- **Input:** textarea (`rows=2`), placeholder "Challenge a recommendation… (Enter to send, Shift+Enter for newline)". Enter sends; Shift+Enter inserts a newline. Purple send button "→" (⚙️ spinning while streaming). Disabled when the input is empty or a stream is in progress.
- **Footer:** `"{floor(len/2)} exchange(s)"` and "✕ Close Chat".

**K. Section "PHASE 3 · ✅ Review & Override"** (phase ∈ awaiting_review / executor_running / complete):
- Hint: "Prices applied · history view" when complete, otherwise "Set final % per SKU or group · submit to execute".

**L. SKU Review grid:**
- **Header:**
  - "SKU Review & Approval". Adds a gray "Manual Override Mode" pill when there's no agent text and the phase isn't complete.
  - Sub: "Grouped by category · Bulk override per group or per SKU · Submit to execute".
  - Right side:
    - "Expand All SKUs" / "Collapse All" toggle (awaiting_review or complete).
    - Green "✅ Submit for Execution" (awaiting_review; "⚙️ Submitting…" while submitting).
    - "⚙️ Executing…" (executor_running).
    - "✅ Prices Applied" (complete).
- **Table:** `overflow-auto max-h-[520px]`, `text-xs`. Columns:
  - Category / SKU.
  - DS Base ℹ.
  - Macro Δ ℹ.
  - **Proposed** ℹ.
  - Current LP.
  - New LP.
  - Margin.
  - Rev Uplift.
  - Flags.
  - "Override %" ("Approved %" when complete; `w-28`).
- **Loading row** (no rows yet): ⏳ "Loading SKU data…".
- **Group header rows:** one per `category||sub_category`, in insertion order.
  - Chevron, sub_category (bold), then `"{category} · {n} SKUs"`.
  - A red "{k} blocked" chip if any row has a hard block.
  - Proposed column: `displayPct` (the group override if set, else the average proposed) plus "avg".
  - Rev Uplift: `+$(sum/1000).toFixed(1)K` in green.
  - Other cells show "—".
  - Override cell:
    - In awaiting_review: a number input (`min 0 max 15 step 0.1`, placeholder `"{avg} (all)"`, title "Apply this % to all SKUs in group", blue border) with a small × clear button once filled.
    - Otherwise: the plain `displayPct%`.
  - Clicking the row toggles expansion. The override cell stops propagation.
- **SKU rows** (when the group is expanded), indented `pl-9`:
  - SKU id and product.
  - DS base %.
  - `+macro%` (amber).
  - Proposed % (bold white).
  - `$current_lp`.
  - **New LP**, one of:
    - With a group override: `$finalLp` in blue plus "▲ grp".
    - With an individual override: `$finalLp` in purple plus "▲ ovr".
    - Otherwise: `$new_lp` (from the server).
  - Margin: `cur% → new%`. The new value is green if higher, amber otherwise.
  - `+$(uplift/1000).toFixed(1)K`. This is **not** recomputed for overrides.
  - Flag chips by rule id, with `msg` as the title tooltip. "—" when there are none.
  - Override cell:
    - In awaiting_review without a group override: an input (placeholder = proposed, purple focus) with a × clear button.
    - Complete: the approved % (override else proposed).
      - If it differs from proposed by ≥0.05: purple, plus `(+/-diff)`.
      - Otherwise: green with ✓.
    - Otherwise: the effective %.
  - Hard-blocked rows get `bg-red-900/5`.

**M. Section "PHASE 3 · ✅ Executor · Applies approved prices · routes to downstream systems"** (executor_running / complete). The label "Phase 3" is reused verbatim.

**N. Executor panel:**
- Collapsible.
- Border: `border-green-600 shadow-lg` while running.
- Header right side: "Implementing…" while running, "✓ Done" when complete.
- Body: monospace pre-wrap, `max-h-64`. Empty: "Preparing implementation…". Blinking green cursor while running. Auto-scrolls.

#### 7.5.4 Workspace actions (exact behavior) [CODE]

**`_beginCommitteeSession()`** (used by Run Agents and by manual-mode Run Agents):
1. Set phase `committee_running`.
2. Clear the agent texts and refs.
3. `activeAgent = "planner"`.
4. Clear executor text, preview, overrides, collapsed state, summary, and tool calls.
5. Notify `{info, "Pricing Committee Convened", 'Committee started for "{name}".'}`.
6. `new EventSource(committeeStreamUrl(id))`.
7. `onmessage` (parse JSON; ignore parse errors):
   - `done===true && phase==="awaiting_review"` → `transitionToReview()`.
   - `tool_call && agent==="builder"` → append it to `builderToolCalls`.
   - `agent` missing or `"system"` → ignore. (The system intro line is **never shown**.)
   - `done && full` for a committee agent:
     - Set that agent's final text and `activeAgent=null`.
     - If the agent is `critic` → `transitionToReview()`.
   - `chunk` → `activeAgent=agent`; append the chunk; auto-scroll.
8. `onerror` → if not yet transitioned: phase `idle`; close the stream. The partial text is kept on screen.

**`transitionToReview()`** (runs once):
1. Close the EventSource.
2. Phase `awaiting_review`.
3. `negotiationStep="chat"`. Clear the chat messages and input.
4. Collapse the 3 panels.
5. `fetchProjectPreview` → set the preview, then notify `{success, "Analysis Ready", "{n} SKUs ready for your review."}`.
6. In parallel: `summaryLoading=true`, then `summarizeNarrative(id, {planner_text, builder_text, critic_text})` → `narrativeSummary`. On error: stop loading silently.

> Group expansion is **not** set here, so all groups start collapsed after a live run. That differs from the restore path, which expands all of them.

**`submitForExecution()`**:
1. Guard: return if already submitting or there's no preview.
2. Build `decisions` for every row. Priority: group override → individual override → `proposed_pct`.
   - The value is `parseFloat(str) || proposed`. **"0" and invalid values fall back to proposed.**
3. `await reviewApprove(id, decisions)`. There's no error handling.
4. Phase `executor_running`. Expand the executor panel.
5. Notify `{info, "Executor Running", "Applying approved pricing decisions…"}`.
6. `new EventSource(executorStreamUrl(id))`.
   - `chunk` → append to the executor text.
   - `done && full`, **or** `done && phase==="complete"` → `finishExecution` (once):
     - Close the stream.
     - Set the full text if present.
     - Phase `complete`.
     - `markProjectComplete(id)` (errors swallowed).
     - Notify `{success, "Prices Applied", 'Pricing complete for "{name}".'}`.
   - `onerror` (before done) → phase `awaiting_review`.

**`skipToManualReview()`** (Price Manually):
1. `isManualMode=true`.
2. If the phase is `complete`: `await resetProject` and clear overrides, group overrides, and executor text. Otherwise: `await skipCommittee` (server no-op).
3. Fetch the preview, then:
   - Expand all groups.
   - Clear overrides.
   - Phase `awaiting_review`, `negotiationStep="grid"`.
   - Notify `{info, "Manual Review Mode", "Set price changes manually — no AI committee run."}`.

> Agent texts are **not** cleared in this path. Re-pricing a completed project manually therefore still shows the old (now server-reset) agent panels until reload.

**`rerunCommittee()`** (↺ Re-run Agents / Reopen for Pricing):
1. `isManualMode=false`. `await resetProject`.
2. Phase `idle`. Clear all texts, preview, overrides, group overrides, expanded groups, executor text, summary, and tool calls.
3. `negotiationStep="chat"`. Clear the chat and `localStorage.removeItem("negotiate_chat_{id}")`.
4. Notify `{info, "Project Reset", "Committee will re-analyse from scratch."}`.
5. It does **not** auto-launch.

**`runAgentsAfterManual()`**: `isManualMode=false`, `await resetProject`, clear group overrides and expanded groups, then `_beginCommitteeSession()`.

**`stopAgents()`**:
1. Close the EventSource. Phase `idle`.
2. Clear texts, tool calls, summary, preview, overrides, executor text, and chat. `negotiationStep="chat"`.
3. Close the modal.
4. Notify `{info, "Agent Run Stopped", "All in-progress outputs discarded."}`.
5. **No backend call.** The server status stays `running`.

**`sendChatMessage()`**:
1. Guard: input non-empty and not streaming.
2. Append the user message. `streaming=true`.
3. POST `/api/projects/{id}/negotiate` with:
   - `{message, history: prior messages (excluding the new one), executor_output: narrativeSummary || "Committee pricing analysis not yet summarised.", preview_rows: previewData?.rows ?? []}`
4. If `!res.ok` → throw. Otherwise append an empty assistant message and read the stream: split on `\n`, keep lines starting with `data: `, JSON-parse them, and append `chunk` to the last message.
5. On any error, append the assistant message "Unable to reach the negotiation agent. Please try again."
6. `streaming=false`.
7. Messages persist to `localStorage["negotiate_chat_{id}"]` whenever the list is non-empty.

### 7.6 `/projects/[id]/negotiate` Full Negotiation page

- **Data source:** **only** `sessionStorage["negotiate_{id}"]`, with shape `{executorText, rows}`. That key is written by `openNegotiate()` in the workspace, **which is never called**. The "Full Analysis ↗" button routes there directly. **Result: in normal use this page shows "0 SKUs available"** **[INFERRED, high confidence]**. Reproduce as-is, or fix and log it as a deviation (§19).
- **Layout** (`flex`, `max-w-7xl`):
  - **Header:** "← Back to Project" → `/projects/{id}`. "Negotiate with Agents". Sub: "Challenge recommendations · Request alternatives · Understand the pricing rationale". Right: a pill "{n} SKUs available · select one to analyze".
  - **Left (`w-56`):** "Search SKUs…" filter (id or product name, case-insensitive). The list shows the id, product, sub_category, and proposed % (amber when >4, else green). The selected item gets `bg-blue-900/20 border-l-2 border-l-blue-500`. Empty: "No SKUs match". The first row is auto-selected.
  - **Center (`w-80`):**
    - "Price Build-Up" waterfall (`WaterfallBar`):
      - Unit Cost (base bar, width `min(v*5,100)%`, label `$v`).
      - Gross Margin (`current_margin_pct*100`).
      - Divider, "Current LP".
      - DS Model %.
      - Macro Delta %. Delta bars use width `min(|v|*30,60)%`, min width 32px.
      - Divider, "Proposed LP" `$new_lp ↑X.X%`.
    - 2×2 stats:
      - Confidence (green when ≥0.8).
      - Trend. It compares against lowercase `"growing"`/`"declining"`, so it **always renders gray** with the data's capitalized values.
      - Margin Δ in pp.
      - Rev Uplift.
    - "💡 Historical Insights": a lookup of `HISTORICAL_INSIGHTS[sub_category] ?? HISTORICAL_INSIGHTS[category]`. The keys are "Access Control", "Electromechanical Locks", "Door Hardware", and "Electric Strikes". **None match the data's sub-categories or categories, so it always shows "No historical data for this sub-category."** The full text of the insights is in `app/projects/[id]/negotiate/page.tsx` lines 18–36; copy it verbatim.
  - **Right:** "💬 Pricing Agent Chat" / "Ask why · Challenge assumptions · Explore alternatives".
    - Empty state 🤝 with 5 suggestions:
      - "Why was this increase % chosen?"
      - "What if we cap this SKU at 3%?"
      - "Explain the DS model contribution"
      - "What's the risk of the full proposed increase?"
      - "Show me alternatives for declining-trend SKUs"
    - The chat is the same style as the inline one. Placeholder: "Challenge a recommendation… (Enter to send)".
    - Error message: "Sorry, I couldn't reach the pricing agent. Please try again."
    - **No history is sent.** Each question is one-shot.
- **Request:** `POST /api/negotiate {system, question}`. The system prompt is built client-side; see §12.6.

### 7.7 `/settings` (UI-only)

- **Header:** "Settings" / "Configure rule engine guardrails and autonomy routing". Tabs: "Rule Engine" | "Autonomy Configuration". The active tab gets a `border-b-2 border-blue-500` underline.
- **Rule Engine tab:**
  - Type legend pills: Hard Block `bg-red-600/80`, Soft Warn `bg-amber-600/80`, Info `bg-blue-600/80`, all white text.
  - "+ Add Rule" button.
  - Table columns: ID (mono), Rule Name (plus description below), Type pill, Threshold (mono), Action, Active (a toggle switch `w-10 h-5`; knob at left 22px/2px; blue when on), Edit/Del.
  - Inactive rows render at `opacity-40`.
  - Default rules: the same 8 as `/rules` (§11.3 table "UI rule catalog").
- **Add/Edit modal:**
  - Text fields Rule Name, Applies To, Threshold, Action, Description, plus a Type select.
  - Save requires a name. A new rule gets id `G{Date.now()}` with defaults `{type: "Soft Warn", applies_to: "All SKUs", active: true}`.
- **Autonomy tab:**
  - Tier pills plus "Save Configuration". The button switches to "✅ Saved" until the next change. Nothing is persisted.
  - SKUs are grouped by `category||sub_category` and sorted alphabetically.
  - Each row shows a tier badge and A/B/C buttons. `DEFAULT_TIER` is keyed by names like "Deadlatch" and "Smart Lock" but looked up by **sub_category**, so every row defaults to **B**.
  - Tier labels: A "Auto-Apply", B "Pricing Approval", C "Admin Approval".
- All state resets on reload.

### 7.8 `/admin` (UI-only)

- **Header:** "Admin Console" / "Manage users, access levels, and platform configuration". Tabs "User Management" | "System".
- **Users tab:**
  - "Invite User" card with Name (optional), Email Address * (`type=email`, but only checked for being non-empty), and an Access Level select (Read / Edit / Admin, default Edit).
  - Three access description cards; the selected level is highlighted:
    - Read: "View projects, SKUs, and recommendations"
    - Edit: "Create projects, override prices, submit approvals"
    - Admin: "Full access including user management and settings"
  - "Send Invite →" ("Sending invite…", 600 ms fake delay). Appends a `pending` user with name defaulting to the email local-part and joined = today.
  - Table:
    - Header "Platform Users ({n})" plus "{k} pending invite".
    - Columns: User (initial avatar), Email, Access pill, Status ("Active" green / "Invite Sent" amber), Joined, a Change Access select, and Remove.
  - Seed users: 3 records (admin / edit / read). The original seeds included personal name and email data, which is redacted. **Use placeholders** such as `Owner Admin <owner@example.com>`, `Pricing Manager <pricing@company.com>`, and `Read-only Viewer <viewer@company.com>`.
- **System tab:**
  - "Platform Information" key/value grid:
    - Platform: "PriceMind AI v1.0 POC"
    - Runtime LLM: "Configured model · Codex-assisted development"
    - DS Model: "DemandModel-v2.1 (2025-03-15)"
    - SKU Catalog: "28 SKUs — Assa Abloy Electromechanical"
    - Macro Data: "Mar-2025 YoY · Composite +4.8%"
    - Guardrails: "G1–G8 active"
  - "API Configuration": a static masked key `sk-or-••••…` and "✓ Connected". This is not a real status check.

### 7.9 `/rules` and `/autonomy` (orphaned, UI-only)

These are functionally the same as the Settings tabs, with small copy differences:
- `/rules`: header "Rule Engine" / "Define guardrails and business rules that govern agent pricing decisions". Legend pills add the descriptions "— blocks the recommendation" / "— adjusts with warning" / "— informational only". The table has an extra "Applies To" column.
- `/autonomy`: header "Autonomy Configuration" / "Set approval routing per product sub-category — agents always run fully autonomously". It adds:
  - A gradient summary bar with per-tier sub-category and SKU counts, plus "Agents always run autonomously — only approval routing differs".
  - Tier legend cards with conditions and approvers:
    - A: "Change < 2% · Confidence > 95% · Vol Risk LOW" / "No approval required".
    - B: "Change 2–8% · Standard SKUs" / "Pricing Team".
    - C: "Change > 8% · Strategic or Declining SKUs" / "Platform Admin".
  - "Loading SKU data…".
  - A "Notes" card with 4 bullets (copy verbatim from the source).

---

## 8. Frontend Components and State Management

### 8.1 Component inventory

There are no shared UI primitives. Every page is a single large client component with inline JSX.

| Component | Type | Responsibility |
|---|---|---|
| `RootLayout` (`app/layout.tsx`) | server | HTML shell, metadata, wraps `Providers` |
| `Providers` (`components/Providers.tsx`) | client | `AuthContext {user, login, logout}` + `NotifContext {notifications, unreadCount, addNotification, markAllRead}` |
| `useAuth()`, `useNotifications()` | hooks | context accessors |
| `Navbar` | client | top bar, dropdowns (§7.0) |
| `WaterfallBar` (local to negotiate page) | client | props `{label, value, color, isBase?}` |
| Page components | client | one per route (§7) |

### 8.2 State

| State | Scope | Persistence |
|---|---|---|
| `user` (`{name, role, brand, avatar}`) | global context | `localStorage["pricemind_user"]` (JSON) |
| notifications | global context | none (resets to 4 seeds on reload) |
| filters / selection / tabs / modal fields | page-local `useState` | none |
| workspace: `phase`, `agentTexts`, `activeAgent`, `collapsed`, `builderToolCalls`, `previewData`, `overrides` (SKU→string), `groupOverrides` (groupKey→string), `expandedGroups`, `narrativeSummary`, `macroData`, `negotiationStep`, `chatMsgs`, `isManualMode`, `stopWarning`, `submitting` | page-local | chat → `localStorage["negotiate_chat_{id}"]`; everything else is rebuilt from the server on load |
| `agentFinalText` ref | page-local | read by `transitionToReview` to avoid stale closures |
| `committeeEsRef` ref | page-local | the open EventSource |
| negotiate page rows/executorText | page-local | read once from `sessionStorage["negotiate_{id}"]` |

There's no caching library, no SWR/React Query, no global store, no error boundaries, and no toast library. The "notifications" are the bell-dropdown entries.

Seed notifications (copy exactly):

| id | type | title | body | time | read |
|---|---|---|---|---|---|
| n1 | alert | Steel Index Threshold Breached | Steel Index YoY reached +6.1% — repricing recommended for Door Hardware SKUs. | 2 hours ago | false |
| n2 | warning | 4 SKUs Overdue for Repricing | DL-1001, DL-1005, DB-2004, DB-2010 have not been repriced in 12+ months. | 5 hours ago | false |
| n3 | warning | Margin Erosion Detected | DL-1001 margin eroded to 22.9% — below 25% target. Builder Agent flags for immediate action. | Yesterday | false |
| n4 | info | Freight Index Rising | Freight Index now +5.4% YoY. Commercial SKUs most impacted. Consider proactive repricing. | 2 days ago | true |

New notifications get `id: "n{Date.now()}"`, `time: "Just now"`, `read: false`, and are prepended.

### 8.3 API client (`lib/api.ts`)

`const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";`. This value is inlined at build time.

| Function | HTTP | Error handling |
|---|---|---|
| `fetchSkus()` | GET `/api/skus` | none (returns `r.json()`) |
| `fetchSkuAssignments()` | GET `/api/sku-assignments` | none |
| `fetchHierarchy()` | GET `/api/hierarchy` | none (**unused**) |
| `fetchMacro()` | GET `/api/macro` | none |
| `fetchGuardrails()` | GET `/api/guardrails` | none (**unused**) |
| `fetchProjects()` | GET `/api/projects` | none |
| `fetchProject(pid)` | GET `/api/projects/{pid}` | none (404 body returned as data) |
| `createProject(body)` | POST `/api/projects` | throws `Error(detail \|\| "Failed to create project")` when `!ok` |
| `approveProject(pid, approvals)` | POST `/api/projects/{pid}/approve` body `{approvals}` | none (**unused**) |
| `fetchProjectPreview(pid)` | GET `/api/projects/{pid}/preview` | none |
| `reviewApprove(pid, decisions)` | POST `…/review-approve` body `{decisions}` | none |
| `markProjectComplete(pid)` | POST `…/complete` | none |
| `resetProject(pid)` | POST `…/reset` | none |
| `summarizeNarrative(pid, texts)` | POST `…/summarize` | none |
| `updateProject(pid, body)` | PATCH `/api/projects/{pid}` | throws `Error(detail \|\| "Failed to update project")` |
| `deleteProject(pid)` | DELETE `/api/projects/{pid}` | throws `Error(detail \|\| "Failed to delete project")` |
| `skipCommittee(pid)` | POST `…/skip-committee` | none |
| `committeeStreamUrl(pid)` / `executorStreamUrl(pid)` | URL builders for EventSource | — |

The two negotiation calls are **inline `fetch`es** in the page components. They are not in `lib/api.ts`.

Formatting helpers (inline):
- `fmtUSD(v)` = `$` + `toLocaleString(undefined,{min:2,max:2 fraction digits})`.
- `fmtPct(v)` = `(v*100).toFixed(1)%`.
- `fmtK` (§7.5).
- Revenue `$(v/1000).toFixed(0)K` / `toFixed(1)K`.
- Today = `new Date().toISOString().slice(0,10)`. **This is the UTC date**, so near midnight it can differ from the user's local date.

---

## 9. Frontend-to-Backend Integration Map

| Screen | User action | Client call | Endpoint | Result in UI |
|---|---|---|---|---|
| Dashboard | mount | `fetchSkus`, `fetchSkuAssignments` | GET `/api/skus`, `/api/sku-assignments` | table + lock badges |
| Dashboard | Launch (modal) | `createProject` | POST `/api/projects` | redirect to workspace |
| New Project | mount | `fetchSkus`, `fetchSkuAssignments` | same | table, locked rows |
| New Project | Create & Launch | `createProject` | POST `/api/projects` | redirect / inline error |
| Projects | mount | `fetchProjects` | GET `/api/projects` | cards |
| Projects | expand Manage SKUs (first time) | `fetchSkus` + `fetchSkuAssignments` | GET ×2 | picker |
| Projects | Save edit | `updateProject` | PATCH `/api/projects/{pid}` | card merged / inline error |
| Projects | Delete | `deleteProject` | DELETE `/api/projects/{pid}` | card removed |
| Workspace | mount | `fetchMacro`, `fetchProject`, maybe `fetchProjectPreview` | GET `/api/macro`, `/api/projects/{pid}`, `/api/projects/{pid}/preview` | restored phase |
| Workspace | Run Agents | `EventSource` | GET `/api/projects/{pid}/committee/stream` | live panels |
| Workspace | (auto) after critic | `fetchProjectPreview`, `summarizeNarrative` | GET `…/preview`, POST `…/summarize` | grid + KPIs + summary |
| Workspace | Price Manually | `skipCommittee` or `resetProject`, then `fetchProjectPreview` | POST `…/skip-committee` \| `…/reset`, GET `…/preview` | grid |
| Workspace | Re-run / Reopen | `resetProject` | POST `…/reset` | idle |
| Workspace | Send chat | inline `fetch` | POST `/api/projects/{pid}/negotiate` | streamed reply |
| Workspace | Submit for Execution | `reviewApprove`, then `EventSource`, then `markProjectComplete` | POST `…/review-approve`, GET `…/executor/stream`, POST `…/complete` | executor panel, complete |
| Negotiate page | Send | inline `fetch` | POST `/api/negotiate` | streamed reply |
| Settings / Autonomy | mount | `fetchSkus` | GET `/api/skus` | tier rows |
| — | — | — | GET `/api/hierarchy`, `/api/guardrails`, `/api/history/{sku_id}`, `/api/ds-model/predictions`, POST `/api/projects/{pid}/approve` | **not called** |

All frontend calls match an implemented backend route. There are **no unresolved contracts**.

---

## 10. Complete Backend API Reference

**Conventions [CODE/RUN]:**
- Base path `/api`. No versioning. JSON bodies.
- No authentication. No auth headers are read.
- Errors use FastAPI's default `{"detail": "<string>"}`. Pydantic validation errors return 422 with `{"detail":[{type,loc,msg,input},…]}`.
- Success responses are bare objects or arrays (no envelope). Status is **200** for every success, including creates (no 201).
- **Middleware:** only `CORSMiddleware(allow_origins=["*"], allow_methods=[GET,POST,PUT,PATCH,DELETE,OPTIONS], allow_headers=["*"])`. `allow_credentials` defaults to False.
- No logging setup, no rate limiting, no request timeouts.
- **DB access:** each handler opens `with SessionLocal() as db:`. There's no dependency injection.
- **Startup hook:** `@app.on_event("startup") _migrate()` calls `Base.metadata.create_all(engine)`, then tries 5 `ALTER TABLE projects ADD COLUMN …` statements, swallowing any exception (§13.3). **The app fails to start if `DATABASE_URL` is unset**: `RuntimeError("DATABASE_URL is not set. Add it to your .env file.")`.
- **SSE format:** each event is `data: <json>\n\n`. Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`, media type `text/event-stream`. No `event:` or `id:` fields, and no keep-alive pings.

### 10.1 Endpoint inventory

| # | Method | Path | Purpose | Consumer |
|---|---|---|---|---|
| E1 | GET | `/api/skus` | full catalog | dashboard, new, projects (edit), settings, autonomy |
| E2 | GET | `/api/hierarchy` | BG→Category→Sub→Brand→[SKU] tree | unused |
| E3 | GET | `/api/macro` | macro indicators | workspace |
| E4 | GET | `/api/guardrails` | guardrail rows (incl. header row) | unused |
| E5 | GET | `/api/history/{sku_id}` | 12-mo per-SKU history | unused |
| E6 | POST | `/api/projects` | create project | dashboard modal, new page |
| E7 | GET | `/api/projects` | list projects | projects page |
| E8 | GET | `/api/projects/{pid}` | project detail | workspace |
| E9 | GET | `/api/sku-assignments` | SKU→project lock map | dashboard, new, edit modal |
| E10 | PATCH | `/api/projects/{pid}` | update project | edit modal |
| E11 | DELETE | `/api/projects/{pid}` | delete project | delete modal |
| E12 | POST | `/api/projects/{pid}/approve` | set status `approved` | unused |
| E13 | GET | `/api/ds-model/predictions` | DS predictions, all SKUs | unused |
| E14 | GET | `/api/projects/{pid}/preview` | deterministic pricing grid | workspace |
| E15 | POST | `/api/projects/{pid}/complete` | write history, status `complete` | workspace |
| E16 | POST | `/api/projects/{pid}/reset` | clear outputs and decisions, status `pending` | workspace |
| E17 | POST | `/api/projects/{pid}/skip-committee` | no-op (404 check only) | workspace |
| E18 | POST | `/api/projects/{pid}/summarize` | LLM summary, persisted | workspace |
| E19 | POST | `/api/projects/{pid}/review-approve` | save HITL decisions, status `review_complete` | workspace |
| E20 | GET | `/api/projects/{pid}/committee/stream` | SSE Planner→tools→Builder→Critic | workspace |
| E21 | GET | `/api/projects/{pid}/executor/stream` | SSE Executor | workspace |
| E22 | POST | `/api/projects/{pid}/negotiate` | streamed contextual chat | workspace |
| E23 | POST | `/api/negotiate` | streamed one-shot chat with a client-supplied system prompt | negotiate page |

### 10.2 Shared schemas

**SKU object** (as stored in `sku_data.json`; returned verbatim) [RUN]:

```json
{
  "sku_id": "DL-1001", "product_name": "Deadlatch Standard",
  "category": "Deadlatch", "sub_category": "Residential", "type": "SKU",
  "list_price": 42.5, "unit_cost": 28.8, "margin_pct": 0.2291828039537365,
  "avg_units_mo": 979, "trend": "Stable", "ship_per_unit": 3.1, "revenue_12mo": 435346,
  "components": null, "brand": "Yale", "business_group": "Door Hardware",
  "product_group_4": "Residential Hardware", "product_group_1": "Security Hardware",
  "channel": "Retail / Wholesale", "customer_segment": "Homeowners & Builders",
  "ytd_units": 9790, "ytd_revenue": 361985.0, "last_price_change": "2024-01-01",
  "realization_rate": 0.823,
  "channel_split": { "primary": "Retail / Wholesale", "pct": 63, "secondary": "Distribution" },
  "top_customers": 6, "months_since_reprice": 7
}
```

Field types:
- Strings, except `list_price`, `unit_cost`, `margin_pct` (fraction 0–1), `realization_rate` (fraction), `ship_per_unit`, and `ytd_revenue` (floats).
- `avg_units_mo`, `revenue_12mo`, `ytd_units`, `top_customers`, `months_since_reprice` (ints).
- `components`: string or null. Configured SKUs carry a composition text, e.g. `"Deadlatch Std (60%) + Strike Plate (25%) + Hardware Kit (15%)"`.
- Enums:
  - `type` ∈ {SKU, Configured}
  - `trend` ∈ {Stable, Growing, Declining}

**ProjectDetail** (E6 create response, E8) [RUN]:

```json
{
  "id": "proj-c14b3b69", "name": "Residential Test",
  "group_field": "custom", "group_value": "selection",
  "skus": [ /* full SKU objects, in catalog order */ ],
  "status": "pending", "target_revenue": 250000.0,
  "start_date": "2026-11-01", "end_date": "2026-12-01",
  "review_decisions": { "DL-1001": 5.0 },
  "approvals": {},
  "narrative_summary": "", "planner_output": "", "builder_output": "",
  "critic_output": "", "executor_output": "",
  "committee_last_run": ""
}
```

- Nulls are coerced to `""` (or `0` for `target_revenue`).
- `committee_last_run` is an ISO-8601 string (`datetime.isoformat()`) or `""`.
- `approvals` is always `{}` (vestigial).
- `skus` keeps **catalog order**, filtered to the project's IDs. SKU IDs not present in the catalog are silently dropped.

**ProjectListRow** (E7, E10 response) [RUN]: `{id, name, skus:[SKU…], status, target_revenue, start_date, end_date}`.
- In E7 the order of `skus` follows **Python set iteration and is not deterministic**.
- E10 adds `"sku_changed": bool` and uses catalog order.

**Status enum:** `pending` (default) | `running` | `review_complete` | `executing` | `complete` | `approved` (only via the unused E12). Transitions are in §11.8.

### 10.3 Endpoint details

**E1 `GET /api/skus`** returns 200 with an array of 28 SKU objects, in the JSON's order. Source: an in-memory cache of `sku_data.json` (loaded on first access).

**E2 `GET /api/hierarchy`** returns 200 with `{business_group: {category: {sub_category: {brand: [SKU…]}}}}`. Missing `business_group` or `brand` falls back to `"Other"`. Verified top level [RUN]: `Door Hardware`, `Specialty Security`, `Electronic Security`.

**E3 `GET /api/macro`** returns 200 with `[{indicator: string, values: {"Apr-24": number, …, "Mar-25": number}}]`. There are 8 indicators with 12 monthly fractional YoY values each, in insertion order. The latest (Mar-25) values:

| Indicator | Mar-25 |
|---|---|
| CPI (YoY %) | 0.032 |
| PPI - Metals (YoY %) | 0.048 |
| Steel Index (YoY %) | 0.061 |
| Zinc Spot (YoY %) | 0.029 |
| Freight Index (YoY %) | 0.054 (stored as 0.05400000000000001) |
| USD/INR Delta (%) | 0.018 |
| Copper Index (YoY %) | 0.038 |
| Energy Cost Index (%) | 0.026 |

The frontend takes "latest" as `Object.values(values).at(-1)`, so it depends on key insertion order.

**E4 `GET /api/guardrails`** returns 200 with an array of `{rule_id, rule_name, type, threshold, action, description}`. **Element 0 is a spreadsheet header row** (`{"rule_id":"Rule ID",…}`), followed by G1–G8 (§11.3).

**E5 `GET /api/history/{sku_id}`** returns 200 with `{"List Price ($)": {month: n}, "Units Sold": {…}, "Revenue ($)": {…}, "Unit Cost ($)": {…}, "Shipping $/Unit": {…}, "Gross Margin %": {…}}`, where each series covers 12 months Apr-24..Mar-25. Unknown id → **404 `{"detail":"SKU not found"}`** [RUN].

**E6 `POST /api/projects`**
- Body (`ProjectCreate`):

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| name | str | yes | — | no length/blank validation server-side |
| group_field | str | yes | — | frontend always sends `"custom"` |
| group_value | str | yes | — | frontend always sends `"selection"` |
| sku_ids | list[str] | yes | — | **empty list accepted** [RUN]; unknown IDs accepted and stored, then dropped on read |
| target_revenue | float | no | 0 | |
| start_date | str | no | "" | ISO date string expected; compared as string |
| end_date | str | no | "" | |

- Processing:
  1. If both dates are set and `end_date <= start_date` (string comparison) → **422 `{"detail":"Review date must be after start date."}`**.
  2. Conflict check: any `project_skus` row with `sku_id IN body.sku_ids` → **409** `{"detail":"SKU(s) DL-1001 already assigned to project 'Residential Test'"}`. The ID list comes from a set (order not guaranteed). The name comes from the first conflict's project.
  3. `pid = "proj-" + uuid4().hex[:8]`. Insert the Project (`status="pending"`). `flush`. Insert a ProjectSku per id (duplicates in the body would violate the composite PK → **500 [INFERRED]**). Commit.
- Success: 200 ProjectDetail.
- No server-side check that start ≥ today (that's frontend only).

**E7 `GET /api/projects`** returns 200 with `ProjectListRow[]` ordered by `created_at DESC`. With no projects it returns `[]`.

**E8 `GET /api/projects/{pid}`** returns 200 ProjectDetail, or **404 `{"detail":"Project not found"}`**.

**E9 `GET /api/sku-assignments`** returns 200 with `{sku_id: {project_id, project_name}}` for every SKU in **any** project, including complete ones. In other words, **SKUs stay locked after their project completes** until the project is deleted or edited [RUN].

**E10 `PATCH /api/projects/{pid}`**
- Body (`ProjectUpdate`), all optional: `name: str|null`, `target_revenue: float|null`, `start_date: str|null`, `end_date: str|null`, `sku_ids: list[str]|null`.
- Processing:
  1. 404 if the project is missing.
  2. Effective dates = body value if not null, else the stored value. If both are set and `end <= start` → **422 "Review date must be after start date."** [RUN].
  3. Apply the non-null scalar fields.
  4. If `sku_ids` is given and the set differs from the current set:
     - Conflict check **only for newly added IDs** in other projects → **409** `"SKU(s) {ids} already belong to project '{name}'. A SKU can only be in one project."`
     - Otherwise: delete all of the project's `project_skus` and insert the new set.
     - **Reset:** `status="pending"`; planner/builder/critic/executor outputs, `committee_last_run`, and `narrative_summary` → NULL; delete the project's `review_decisions`. `sku_changed=true`.
  5. Commit.
- Success: 200 `ProjectListRow + {"sku_changed": bool}`.
- An empty `sku_ids: []` is accepted server-side (the UI blocks it). Pricing-history rows are **not** deleted, even though the UI warning mentions "execution history".

**E11 `DELETE /api/projects/{pid}`** returns 200 `{"deleted": pid}`, or 404. The ORM cascade deletes `project_skus` and `review_decisions` (`cascade="all, delete-orphan"`). `pricing_history` rows are **kept** (no FK) [RUN].

**E12 `POST /api/projects/{pid}/approve`** accepts any JSON dict body (ignored). Sets `status="approved"` and returns 200 `{"status":"ok"}`, or 404. Not used by the UI.

**E13 `GET /api/ds-model/predictions`** returns 200 with `[{sku_id, base_recommendation_pct, confidence, last_run:"2025-03-15", model_version:"DemandModel-v2.1"}]` for all 28 SKUs (§11.1).

**E14 `GET /api/projects/{pid}/preview`** returns 200 `compute_preview(project.skus, 0.87)` (§11.2), or 404. For a project with 0 SKUs it returns zeroed portfolio fields with `target_realization 0.87` and `realization_delta -0.87` [RUN]. `target_realization` is always 0.87, because `_load_project` has no such key and the default is used.

**E15 `POST /api/projects/{pid}/complete`** (no body):
- For each project SKU, in catalog order, insert a `PricingHistory` row:
  - `final_pct = review_decisions.get(sku_id, 0)`
  - `proposed_pct = final_pct` (sic)
  - `old_lp = list_price`
  - `new_lp = round(list_price*(1+final_pct/100), 2)`
  - `product_name`, `project_name`
- Then `status="complete"`. Returns 200 `{"status":"ok"}`, or 404.
- **Not idempotent:** calling it twice writes duplicate history rows.
- **The catalog `list_price` is never updated.** "Prices applied" is only recorded in history.
- [RUN] With decisions `{DL-1001:5.0, DL-1003:4.2, DB-2001:3.9}`, it wrote `new_lp` values 44.62, 33.08, 56.11.

**E16 `POST /api/projects/{pid}/reset`**: `status="pending"`; nulls the four agent outputs, `committee_last_run`, and `narrative_summary`; deletes `review_decisions`. Returns 200 `{"status":"ok"}`, or 404.

**E17 `POST /api/projects/{pid}/skip-committee`**: a 404 check plus an empty commit. Returns 200 `{"status":"ok"}`. **No state change**: the comment says "frontend transitions to awaiting_review locally".

**E18 `POST /api/projects/{pid}/summarize`**
- Body (`NarrativeBody`), all required strings: `planner_text`, `builder_text`, `critic_text`.
- Processing:
  1. 404 check.
  2. Build the prompt (§12.5), truncating to 1800 / 2200 / 1200 characters respectively.
  3. Non-streaming LLM call, `max_tokens=550`.
  4. `summary = (content or "").strip()`.
  5. Persist to `projects.narrative_summary`.
- Returns 200 `{"summary": "<text>"}`.
- An LLM error is not caught → **500** (FastAPI default `Internal Server Error`, text/plain) **[INFERRED]**.

**E19 `POST /api/projects/{pid}/review-approve`**
- Body: an untyped dict. Reads `body.get("decisions", {})`, a map `sku_id → number`.
- Processing: delete the project's existing decisions; insert one `ReviewDecision(project_id, sku_id, decision_pct)` per entry; `status="review_complete"`; commit.
- Returns 200 `{"status":"ok"}`, or 404.
- No validation of SKU membership or numeric range. A non-numeric pct would fail at insert → **500 [INFERRED]**.

Example request:

```json
{ "decisions": { "DL-1001": 5.0, "DL-1003": 4.2, "DB-2001": 3.9 } }
```

**E20 `GET /api/projects/{pid}/committee/stream`** (SSE)
- Pre-stream (synchronous):
  1. 404 if missing.
  2. Set `status="running"` and commit.
  3. Compute DS predictions and build `ds_context` lines: `"  {sku_id}: DS base={pct}%, confidence={conf:.0%}, model=DemandModel-v2.1, last_run=2025-03-15"`.
- Event sequence (verified from code):

```text
data: {"agent":"system","chunk":"PriceMind AI committee convened for **{name}**\n\n"}
   (sleep 0.2s)
data: {"agent":"planner","chunk":"…"}               × N   (LLM stream)
data: {"agent":"planner","done":true,"full":"<entire planner text>"}
   (sleep 0.3s)
data: {"agent":"builder","tool_call":{name,category,args,result}}   × 5, 0.25s apart
data: {"agent":"builder","chunk":"…"}               × N
data: {"agent":"builder","done":true,"full":"…"}
   (sleep 0.3s)
data: {"agent":"critic","chunk":"…"}                × N
data: {"agent":"critic","done":true,"full":"…"}
   → DB: planner_output, builder_output, critic_output, committee_last_run=now(UTC)
data: {"done":true,"phase":"awaiting_review"}
```

- **Status is not changed after the stream.** It stays `running` (the frontend restore logic handles this).
- There's no error event: an LLM exception ends the stream abruptly and nothing is persisted.
- The five tool calls (static values; only the counts are computed):

| # | name | category | args | result |
|---|---|---|---|---|
| 1 | market_signal_fetch | Data Fetch | `{"indicators":["CPI","PPI_Metals","Steel_Index","Freight_Index","Forex_USD_INR"],"source":"Trading Economics"}` | `{"CPI":"+3.2%","PPI_Metals":"+4.8%","Steel_Index":"+6.1%","Freight_Index":"+5.4%","Forex_USD_INR":"+1.8%","composite_shift":"+4.8%","status":"OK"}` |
| 2 | compute_unit_cost_update | Pipeline Run | `{"sku_count":N,"use_commodity_index":true,"use_freight":true,"use_forex":true}` | `{"avg_cost_increase_pct":4.1,"skus_updated":N,"primary_driver":"Steel_Index (+6.1%)","status":"OK"}` |
| 3 | compute_macro_adjustment | Pipeline Run | `{"weights":{"cpi":0.15,"commodity":0.55,"freight":0.20,"forex":0.10}}` | `{"macro_adjustment_factor":1.048,"composite_shift_pct":4.8,"status":"OK"}` |
| 4 | demand_model_validate | Model Run | `{"model_version":"DemandModel-v2.1","last_run":"2025-03-15","sku_count":N}` | `{"avg_volume_risk":"LOW","high_risk_sku_count":#(avg_units_mo>1200),"model_accuracy_pct":94.2,"drift_detected":false,"status":"OK"}` |
| 5 | guardrail_preflight | Pipeline Run | `{"rules":["G1",…,"G8"],"sku_count":N}` | `{"potential_hard_blocks":#(margin_pct<0.22),"potential_soft_warns":N,"status":"OK"}` |

**E21 `GET /api/projects/{pid}/executor/stream`** (SSE)
- Pre-stream: 404 check; `status="executing"`; commit. Decisions = `review_decisions`. `ds_context` lines = `"  {sku_id}: {pct}%"`.
- Events:
  - `{"agent":"executor","chunk":…}` × N
  - `{"agent":"executor","done":true,"full":…}`
  - DB `executor_output=full`
  - `{"done":true,"phase":"complete"}`
- **Does not set status `complete`.** The frontend calls E15 for that.

**E22 `POST /api/projects/{pid}/negotiate`** (streamed)
- Body (`NegotiateBody`): `message: str` (required), `history: list[dict]` (required; each item has `role` ∈ {user, assistant} and `content`), `executor_output: str` (required), `preview_rows: list[dict] | null`.
- 404 check (before streaming).
- Messages = `[system NEGOTIATION_SYSTEM, assistant "I have the full committee analysis. Here are the key recommendations:\n\n" + executor_output[:2000], …history, user build_negotiation_prompt(...)]` (§12.4).
- Stream events: `{"chunk": "…"}` × N, then `{"done": true}`. There's no `agent` key.

**E23 `POST /api/negotiate`** (streamed)
- Body: `{system: str, question: str}`. No project lookup.
- Messages = `[system=body.system, user=body.question]`. Same stream format as E22.
- **The client controls the system prompt directly** (§15).

---

## 11. Pricing Engine and Business Rules

All of this is in `backend/data_loader.py` and is **deterministic**. The LLM never changes these numbers.

### 11.1 Simulated DS model: `compute_ds_predictions(skus)`

Comment in code: "Simulate a pre-run DS/ML demand model (DemandModel-v2.1, run 2025-03-15)… In production this would be a real model endpoint call."

```python
h = int(hashlib.md5(sku_id.encode()).hexdigest()[:4], 16) % 100   # 0..99, deterministic per SKU
base = 3.5
if margin_pct < 0.22:                               base += 1.0
if trend == "Growing":                              base += 0.5
if trend == "Declining":                            base -= 0.8
if sku.get("months_since_reprice", 6) > 12:         base += 0.8
if sku.get("realization_rate", 0.87) < 0.85:        base += 0.3
noise = (h - 50) * 0.02                             # range -1.00 .. +0.98
base_recommendation_pct = round(max(1.5, min(7.5, base + noise)), 1)
confidence = round(0.78 + (h % 20) * 0.01, 2)      # 0.78 .. 0.97
last_run = "2025-03-15"; model_version = "DemandModel-v2.1"
```

Units are percentage points. Python `round()` is banker's rounding on binary floats; reproduce it with Python semantics (or a decimal-exact equivalent) and check the result against the golden table in §11.9.

### 11.2 Preview grid: `compute_preview(skus, target_realization=0.87)`

Constants: `MACRO_COMPOSITE = 4.8` (composite cost pressure %, "Mar-25").

Per SKU:

```python
ds_base   = ds.get("base_recommendation_pct", 3.5)
macro_add = round(MACRO_COMPOSITE * 0.30, 1)        # = 1.4 (ambient agents ≈30% of composite)
proposed  = round(ds_base + macro_add, 1)
confidence = ds.get("confidence", 0.82)
# guardrails mutate `proposed` (see 11.3) BEFORE financials
real   = sku.get("realization_rate", 0.87)
units  = sku.get("avg_units_mo", 0)
cur_lp = sku["list_price"]
new_lp = round(cur_lp * (1 + proposed/100), 2)
cur_rev = round(cur_lp * units * 12 * real, 0)      # float, e.g. 410916.0
exp_rev = round(new_lp * units * 12 * real, 0)
new_mgn = round(1 - unit_cost / new_lp, 3)
row = {
  sku_id, product_name, brand (""), category, sub_category, type, trend,
  months_since_reprice (0 default), current_lp, unit_cost, avg_units_mo,
  ds_base_pct, macro_delta_pct, proposed_pct, new_lp,
  current_margin_pct: round(sku.margin_pct, 3), new_margin_pct,
  realization_rate, current_revenue_12mo, expected_revenue_12mo,
  revenue_uplift: round(exp_rev - cur_rev, 0), confidence,
  guardrail_flags: [{rule, type, msg}], has_hard_block: bool
}
```

> **Quirk to preserve:** `current_margin_pct` is the catalog's `margin_pct`. That value is **not** `1 - unit_cost/list_price`; it's derived some other way in the source spreadsheet **[UNVERIFIED]**. `new_margin_pct`, however, **is** `1 - unit_cost/new_lp`. So every SKU shows a margin jump of roughly 10–13 pp, which is much larger than the price change alone would produce. Example: DL-1001 goes 0.229 → 0.356.

Portfolio:

```python
tot_cur = Σ current_revenue_12mo ; tot_exp = Σ expected_revenue_12mo
avg_pct = round(Σ proposed_pct / n, 2)          if rows else 0
wt_real = round(tot_exp / Σ(new_lp*avg_units_mo*12), 3) if rows else 0
portfolio = {
  current_revenue_12mo: tot_cur, expected_revenue_12mo: tot_exp,
  revenue_uplift: round(tot_exp - tot_cur, 0), avg_proposed_pct: avg_pct,
  expected_realization: wt_real, target_realization,
  realization_delta: round(wt_real - target_realization, 3),
  skus_with_hard_block: count(has_hard_block),
  skus_with_warnings: count(flags non-empty AND not has_hard_block)   # includes Info-only (G8)
}
```

Edge cases:
- Empty SKU list → zeros (as shown in E14).
- A SKU with `avg_units_mo = 0` contributes 0 to every sum. Division by zero is possible only if **all** units are 0: `wt_real` divides by Σ(new_lp·units·12) = 0 → **ZeroDivisionError → 500 [INFERRED; impossible with the current data]**.

### 11.3 Guardrails (evaluated in this order; `proposed` may be mutated)

| Rule | Condition (code) | Type | Effect | Message (exact f-string) |
|---|---|---|---|---|
| G1 | `proposed > 8` | Hard Block | `proposed = 8.0; blocked = True` | `"Exceeds 8% cap — capped at 8%"` |
| G2 | `margin_pct < 0.20 and proposed < 4` | Hard Block | `proposed = 4.0; blocked = True` | `"Margin <20% requires ≥4% increase"` |
| G3 | `margin_pct < 0.22 and proposed < 3` | Soft Warn | flag only | `"Low margin — suggest ≥3%"` |
| G4 | `avg_units_mo > 1200 and proposed > 5` | Soft Warn | flag only | `f"High volume ({avg_units_mo}/mo) — risk of demand erosion above 5%"` |
| G5 | `realization_rate < 0.85` | Soft Warn | flag only | `f"Realization {realization_rate:.0%} < 85% — list increase may not flow to net"` |
| G6 | `months_since_reprice > 12` | Soft Warn | flag only | `f"{months_since_reprice}mo since last reprice — suggest ≥4.5%"` |
| G7 | `proposed < 4.8 * 0.5` (2.4) | Soft Warn | flag only | `f"Increase {proposed}% < 50% of cost pressure 4.8% — under-absorbing costs"` |
| G8 | `type == "Configured"` | Info | flag only | `"Configured product — verify component margin cascade"` |

Notes:
- "Soft Warn" rules **never change** `proposed`. Only G1 and G2 do.
- **Reachability for any input [RUN, exhaustive check over all rule-relevant inputs and every hash value 0–99]:**
  - **G2, G3 and G7 can never fire.** Any SKU with `margin_pct < 0.22` gets +1.0 on its DS base, so its minimum base is 3.5 + 1.0 − 0.8 − 1.0 = 2.7, which makes proposed ≥ 4.1. That is above both the G2 threshold (<4) and the G3 threshold (<3). G7 needs proposed < 2.4, but the minimum proposed for any SKU is 1.5 + 1.4 = 2.9.
  - **G1 is reachable** only with a synthetic SKU, e.g. DS 6.9 → proposed 8.3 → capped at 8.0 (see `codex-kit/fixtures/golden_pricing.json` → `synthetic_g1_case`).
  - With the current 28 SKUs, G1 also never fires. The flags actually seen are G4, G5, G6 and G8.
  - Still implement all eight rules exactly as written. The unreachable ones are dead code in the original, kept for parity.
- The data file's guardrail descriptions differ from the code for G5 (">14% list vs realized"), G6 ("Margin Erosion >2pp drop") and G4. **The code is authoritative.** The Critic prompt (§12.3) uses its own wording. The Settings UI rule catalog is a third, display-only copy.
- `has_hard_block` doesn't drive anything else: rows can still be overridden and submitted.

UI rule catalog (Settings/Rules, display-only), as `id · name · type · applies_to · threshold · action`:
- G1 · Max Single-Period Cap · Hard Block · All SKUs · "Change > 8%" · "Block → cap at 8%"
- G2 · Min Margin Floor · Hard Block · All SKUs · "Margin < 20% + inc < 4%" · "Force ≥ 4% increase"
- G3 · Margin Warning · Soft Warn · All SKUs · "Margin < 22% + inc < 3%" · "Suggest 3%"
- G4 · Volume Sensitivity · Soft Warn · "Units/Mo > 1,200" · "Units > 1200 + inc > 5%" · "Suggest ≤ 5%"
- G5 · Realization Gap · Soft Warn · All SKUs · "Realization rate < 85%" (Settings: "Realization < 85%") · "Warn — may not flow"
- G6 · Overdue Repricing · Soft Warn · All SKUs · "Last reprice > 12 months" · "Suggest ≥ 4.5%"
- G7 · Cost Absorption · Soft Warn · All SKUs · "Inc < 50% of cost pressure" · "Warn — under-absorbing"
- G8 · Configured SKU Cascade · Info · Configured SKUs · "Type = Configured" · "Info — check components"

(The descriptions are in the source files; copy them verbatim.)

### 11.4 Override and decision rules (frontend, `submitForExecution`)

```
for each preview row:
  g = groupOverrides[`${category}||${sub_category}`]; o = overrides[sku_id]
  if g not in (undefined, "")      → decision = parseFloat(g) || proposed_pct
  elif o not in (undefined, "")    → decision = parseFloat(o) || proposed_pct
  else                              → decision = proposed_pct
```

- The **group override wins** over an individual override. When a group override is set, that group's individual inputs are hidden.
- `0`, `NaN`, or blank → falls back to proposed. **A 0% decision cannot be entered.**
- The input `min=0 max=15 step=0.1` is HTML-only and not enforced on submit. Negative or >15 values typed manually are sent as-is.
- **Guardrails are not re-applied to overrides.** For example, 12% can be submitted for any SKU.
- Displayed New LP for an overridden row = `(current_lp*(1+pct/100)).toFixed(2)`.
- Uplift, margin and KPIs **do not update** for overrides.

### 11.5 Date rules

Frontend create (dashboard modal and new page):
- `start < today` → "Start date cannot be before today."
- `end <= start` → "Review date must be after the start date."
- `today` = UTC ISO date.

Edit modal: only the end/start rule. Backend: only `end <= start` → 422 "Review date must be after start date." (note: no "the"). All comparisons are ISO string comparisons.

### 11.6 SKU exclusivity

A SKU can be in at most one project, of any status. This is enforced:
- On create, for all IDs.
- On PATCH, for newly added IDs only.
- In the UI, by lock icons and disabled rows.

It's released only by deleting the project or removing the SKU from it.

### 11.7 Ambient signal tuning (frontend, `ambientSignals` memo)

```
subcatCounts from preview rows; total = rows.length || 1
if counts exist: score[signal] += (count/total) * SUBCAT_SIGNAL_WEIGHTS[subcat][signal]
else: CPI, Steel, Freight, USD/INR each score 1
top4 = signals sorted by score desc (stable), first 4
value = latest macro value (fraction) for that indicator (0 if missing)
mixLabel = top-2 sub-categories by count joined " · " + " heavy"  (or "All categories")
topSignal = max value; compositeAvg = mean of the 4 values
alert = topSignal.value > 0.04 ? `${label} cost pressure dominant (+${(v*100).toFixed(1)}%)`
      : compositeAvg > 0.03   ? `Composite input cost shift +${(avg*100).toFixed(1)}% above threshold`
      : null
```

`SUBCAT_SIGNAL_WEIGHTS`:

| Sub-category | Weights |
|---|---|
| Industrial | Steel .9, PPI-Metals .8, Energy .7, Freight .5 |
| Commercial | Steel .8, CPI .7, Freight .6, PPI-Metals .5 |
| Institutional | Steel .8, CPI .7, Freight .5, PPI-Metals .5 |
| Healthcare | CPI .9, Copper .6, Freight .5, Zinc .4 |
| Smart Home | Copper .9, Zinc .8, Freight .7, Energy .5 |
| Residential | CPI .9, Freight .6, Steel .5, Zinc .4 |

(Use the full indicator names as keys, e.g. `"Steel Index (YoY %)"`.)

`SIGNAL_META` (label / color / icon):
- CPI amber 📈
- PPI amber 🏗
- Steel red ⚙️
- Zinc amber-300 🔩
- Freight amber 🚢
- Forex (USD/INR) amber-300 💱
- Copper orange 🔌
- Energy yellow ⚡

### 11.8 Project status lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending : POST /projects
  pending --> running : GET committee/stream
  running --> running : stream finishes (status NOT updated)
  running --> review_complete : POST review-approve
  pending --> review_complete : POST review-approve (manual path)
  review_complete --> executing : GET executor/stream
  executing --> complete : POST complete (frontend, after executor done)
  any --> pending : POST reset / PATCH with changed sku_ids
  any --> approved : POST approve (unused)
```

### 11.9 Golden reference values (full 28-SKU catalog) [RUN]

Format: SKU · DS base · proposed · new LP · cur margin → new margin · uplift · confidence · flags. No SKU has a hard block.

| SKU | DS | Prop | New LP | Margin | Uplift | Conf | Flags |
|---|---|---|---|---|---|---|---|
| DL-1001 | 3.9 | 5.3 | 44.75 | .229→.356 | 21754 | .93 | G5 |
| DL-1002 | 3.9 | 5.3 | 70.55 | .266→.373 | 28894 | .81 | — |
| DL-1003 | 4.5 | 5.9 | 33.62 | .202→.331 | 35132 | .87 | G4,G5 |
| DL-1004 | 2.5 | 3.9 | 92.47 | .294→.386 | 14146 | .78 | — |
| DL-1005 | 5.5 | 6.9 | 57.99 | .215→.346 | 33929 | .97 | G6 |
| DL-1006 | 3.2 | 4.6 | 64.33 | .248→.353 | 17837 | .91 | — |
| DL-1007 | 3.5 | 4.9 | 37.76 | .222→.333 | 29443 | .83 | — |
| DL-1008 | 5.3 | 6.7 | 30.41 | .204→.316 | 36193 | .94 | G4,G5 |
| DL-1009 | 4.4 | 5.8 | 150.24 | .310→.411 | 18316 | .88 | G6 |
| DL-1010 | 3.2 | 4.6 | 79.50 | .241→.341 | 12186 | .78 | G5,G6 |
| DB-2001 | 4.1 | 5.5 | 56.97 | .259→.384 | 41918 | .96 | G4 |
| DB-2002 | 3.8 | 5.2 | 76.27 | .245→.396 | 34696 | .80 | G6 |
| DB-2003 | 4.9 | 6.3 | 200.91 | .293→.411 | 48022 | .94 | — |
| DB-2004 | 3.2 | 4.6 | 50.21 | .240→.311 | 19248 | .95 | G6 |
| DB-2005 | 5.1 | 6.5 | 41.00 | .227→.322 | 31827 | .86 | G6 |
| DB-2006 | 4.4 | 5.8 | 153.41 | .296→.395 | 48236 | .94 | G5,G6 |
| DB-2007 | 3.7 | 5.1 | 225.96 | .242→.372 | 28708 | .91 | — |
| DB-2008 | 3.0 | 4.4 | 100.22 | .264→.377 | 18250 | .82 | — |
| DB-2009 | 3.1 | 4.5 | 172.42 | .284→.426 | 25670 | .87 | — |
| DB-2010 | 4.6 | 6.0 | 33.92 | .197→.292 | 31461 | .93 | G4 |
| CFG-3001 | 3.7 | 5.1 | 61.22 | .232→.371 | 16914 | .83 | G5,G8 |
| CFG-3002 | 3.3 | 4.7 | 129.83 | .270→.393 | 29221 | .91 | G8 |
| CFG-3003 | 3.5 | 4.9 | 261.20 | .328→.402 | 32326 | .90 | G5,G8 |
| CFG-3004 | 3.9 | 5.3 | 160.06 | .272→.383 | 17094 | .88 | G6,G8 |
| CFG-3005 | 3.7 | 5.1 | 103.00 | .217→.344 | 15757 | .88 | G8 |
| CFG-3006 | 5.0 | 6.4 | 210.67 | .279→.389 | 41344 | .97 | G8 |
| CFG-3007 | 4.7 | 6.1 | 196.28 | .255→.397 | 25030 | .90 | G6,G8 |
| CFG-3008 | 3.9 | 5.3 | 236.92 | .299→.411 | 19829 | .88 | G8 |

**Full-catalog portfolio:**

```json
{"current_revenue_12mo":14197776.0,"expected_revenue_12mo":14971157.0,"revenue_uplift":773381.0,"avg_proposed_pct":5.38,"expected_realization":0.88,"target_realization":0.87,"realization_delta":0.01,"skus_with_hard_block":0,"skus_with_warnings":20}
```

**Project {DL-1001, DL-1003, DB-2001} portfolio:**

```json
{"current_revenue_12mo":1769553.0,"expected_revenue_12mo":1868357.0,"revenue_uplift":98804.0,"avg_proposed_pct":5.57,"expected_realization":0.851,"target_realization":0.87,"realization_delta":-0.019,"skus_with_hard_block":0,"skus_with_warnings":3}
```

---

## 12. AI/LLM Workflow and Prompt Specification

### 12.1 Provider and configuration [CODE]

```python
from openai import AsyncOpenAI
# Codex is the development assistant; this is the app's configurable runtime LLM.
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
```

| Call | Function | Stream | max_tokens | Messages |
|---|---|---|---|---|
| Planner / Builder / Critic / Executor | `stream_agent` | yes | 900 | `[system, user]` |
| Summary | `summarize_narrative` | no | 550 | `[user]` only |
| Negotiation (project) | `stream_negotiation` | yes | 600 | system + seeded assistant + history + user |
| Negotiation (standalone) | `stream_negotiation` | yes | 600 | `[system(client), user]` |

- No temperature, top_p, or stop sequences are set.
- No explicit timeout or retry configuration, so the openai-python SDK defaults apply **[INFERRED]**.
- No fallback model. No token or cost tracking. No logging.
- No tool/function calling is sent to the LLM. The "tool calls" in the UI are server-simulated SSE events (§10.3 E20).
- No RAG, embeddings, or vector store.
- If `OPENROUTER_API_KEY` is missing, the `AsyncOpenAI(...)` constructor raises at **import time** and the backend won't start **[INFERRED from SDK behavior]**.

### 12.2 Committee orchestration

```mermaid
sequenceDiagram
  participant UI as Workspace (EventSource)
  participant API as FastAPI
  participant DB
  participant LLM as OpenRouter
  UI->>API: GET /committee/stream
  API->>DB: status=running
  API-->>UI: system intro
  API->>LLM: Planner(system, build_planner_prompt(skus,name))
  LLM-->>API: tokens
  API-->>UI: planner chunks… done(full)
  API-->>UI: 5 builder tool_call events (0.25s apart)
  API->>LLM: Builder(system, build_builder_prompt(skus,name,planner_out,ds_context))
  API-->>UI: builder chunks… done(full)
  API->>LLM: Critic(system, build_critic_prompt(skus,builder_out))
  API-->>UI: critic chunks… done(full)
  Note over UI: on critic done → close ES, fetch preview, POST summarize
  API->>DB: save outputs + committee_last_run
  API-->>UI: {done, phase: awaiting_review}
  UI->>API: GET /preview ; POST /summarize
  API->>LLM: summary prompt (non-stream)
  API->>DB: narrative_summary
```

> **Race [INFERRED]:** the client closes the EventSource as soon as it receives the Critic `done` event, and the server persists outputs only *after* that event. If Starlette detects the disconnect before the DB write, the outputs and `committee_last_run` are lost and the status stays `running` (with no outputs, so the next load lands in `idle`). The comment "stalled SSE" and the restore logic suggest this has been seen in practice. **To fix it in a replica, persist before yielding the critic `done`, and log the change as a deviation.**

Each agent sees only what's listed below. The agents don't share a running conversation.
- Planner: the SKU list.
- Builder: the Planner's output, the DS context, and the SKUs.
- Critic: the Builder's output and the SKUs.
- Executor: the human decisions, the DS context, and the SKUs. **It does not see the earlier agents' output.**

### 12.3 System prompts (verbatim; `agents/prompts.py`)

**PLANNER_SYSTEM**
```text
You are the **Planner / Brain Agent** for PriceMind AI — an agentic pricing committee platform.

Your role: Create a concise Pricing Blueprint that guides the rest of the committee.

Cover in tight bullets (no prose paragraphs):
1. **Scope** — SKU count, key categories, channels
2. **Cost Pressures** — top 2-3 macro signals relevant to these products
3. **Risk Segments** — group SKUs briefly (margin risk / volume risk / overdue)
4. **Strategy** — one-line recommendation per segment (aggressive / moderate / hold)
5. **Committee Instructions** — 2-3 bullet directives for Builder and Critic

Hard limit: 200 words total. Every word must earn its place.
End with: "Blueprint complete. Handing off to Builder Agent."
```

**BUILDER_SYSTEM**
```text
You are the **Builder / Coding Agent** in PriceMind AI's Agentic Pricing Committee.

Your role: Run the pricing pipeline and propose list price increases for each SKU.

Framework: New LP = Unit Cost × (1 + Target Margin%) × Macro Adjustment Factor
Default margin target: 25% (skip if current margin already > 28%).
Composite macro adjustment ≈ +4.8% (steel 35% + copper 20% + freight 20% + CPI 15% + energy 10%).

Output format — one compact line per SKU, nothing more:
  SKU_ID | +X.X% | $new_LP | driver: [signal] | [volume risk flag if applicable]

No prose. No paragraphs. No explanations per SKU unless it's an outlier needing a brief note (max 10 words).
After the SKU table, add a 2-line portfolio summary: avg increase % and total revenue uplift estimate.
Hard limit: 250 words total.
End with: "Proposals ready. Passing to Critic Agent."
```

**CRITIC_SYSTEM**
```text
You are the **Critic Agent** — guardrail enforcement layer in PriceMind AI.

Your role: Review Builder proposals against guardrails. Only write about SKUs where something fires.

Guardrails:
- G1 HARD BLOCK: increase > 8%
- G2 HARD BLOCK: margin < 20% AND increase < 4% → must raise ≥ 4%
- G3 SOFT WARN: margin < 22% AND increase < 3% → suggest 3%
- G4 SOFT WARN: units/mo > 1,200 AND increase > 5% → cap at 5%
- G5 SOFT WARN: realization < 85% → net revenue may not reflect list increase
- G6 SOFT WARN: months since reprice > 12 → flag overdue, suggest ≥ 4.5%
- G7 SOFT WARN: proposed < 50% of 4.8% composite cost pressure → under-absorbing
- G8 INFO: Configured type → verify margin cascade

Output format — only flagged SKUs, one line each:
  SKU_ID | G# [HARD/SOFT/INFO] | original X% → adjusted Y% | reason (5 words max)

Skip clean SKUs entirely. End with a 1-line count: "X hard blocks, Y soft warnings, Z clean."
Hard limit: 150 words total.
End with: "Guardrail review complete. Passing to Executor."
```

**EXECUTOR_SYSTEM**
```text
You are the **Executor Agent** — final decision-maker in PriceMind AI's Pricing Committee.

Your role: Synthesise the Planner's blueprint, Builder's proposals, and Critic's adjustments into a final, balanced pricing recommendation ready for human review.

Classify each SKU:
- **Category A** (Auto-Apply): change < 2%, confidence > 95%, volume risk LOW
- **Category B** (Manager Approval): change 2–8%, standard SKUs
- **Category C** (Executive Escalation): change > 8% OR strategic/declining SKUs

Produce:
1. Executive summary (3 bullets: total uplift, avg % increase, top risks)
2. Final recommendation per SKU with key contributing factors
3. Approval routing count (A / B / C)

Then output EXACTLY this block — no extra text after it:

<RECOMMENDATIONS_JSON>
{
  "recommendations": [
    {
      "sku_id": "REPLACE",
      "product_name": "REPLACE",
      "current_lp": 0.0,
      "recommended_lp": 0.0,
      "pct_increase": 0.0,
      "approval_category": "B",
      "confidence": "HIGH",
      "volume_risk": "LOW",
      "months_since_reprice": 0,
      "factors": ["Factor 1", "Factor 2", "Factor 3"],
      "guardrail_flags": []
    }
  ],
  "portfolio_summary": {
    "avg_pct_increase": 0.0,
    "total_revenue_uplift": 0,
    "auto_apply_count": 0,
    "mgr_approval_count": 0,
    "exec_escalation_count": 0
  }
}
</RECOMMENDATIONS_JSON>
```

> The `<RECOMMENDATIONS_JSON>` block is **never parsed**. The Executor's raw text, including the JSON block, is shown verbatim in the Executor panel and stored in `executor_output`. Its user prompt (below) asks for a different, concise confirmation format, so the two instructions conflict. Reproduce both as written.

**NEGOTIATION_SYSTEM**
```text
You are the **Negotiation Agent** for PriceMind AI — representing the Pricing Committee.

Rules:
- Max 100 words per response. No preamble, no sign-off.
- Lead with the direct answer, then 2-3 data bullets if needed.
- Always cite specific numbers (margin %, increase %, guardrail rule).
- If an override is within guardrails → acknowledge it in one sentence.
- If it violates a guardrail → state which rule and the adjusted figure.
- If asked about a specific SKU, use its exact data from the SKU reference table.
- If a question covers many SKUs, summarise by segment rather than listing every SKU.
```

### 12.4 Prompt builders (verbatim templates)

Python f-string formats: `:.1%` gives e.g. `22.9%`; `:.0%` gives e.g. `82%`; `${x}` prints the raw float (e.g. `$42.5`).

```python
def build_planner_prompt(skus, project_name):
    lines = "\n".join(
        f"  {s['sku_id']} | {s['product_name']} | Brand: {s.get('brand','?')} | "
        f"BG: {s.get('business_group','?')} | PG4: {s.get('product_group_4','?')} | "
        f"LP: ${s['list_price']} | Margin: {s['margin_pct']:.1%} | "
        f"Units/Mo: {s['avg_units_mo']} | Trend: {s['trend']} | "
        f"Last reprice: {s.get('months_since_reprice','?')} mo ago | "
        f"Channel: {s.get('channel','?')}" for s in skus)
    return f"""Pricing Project: **{project_name}**
{len(skus)} SKUs in scope:
{lines}

Create the Pricing Blueprint for this project. Start with "📋 PLANNER AGENT — PRICING BLUEPRINT" as header."""

def build_builder_prompt(skus, project_name, planner_output, ds_context=""):
    lines = "\n".join(
        f"  {s['sku_id']} | {s['product_name']} | LP: ${s['list_price']} | "
        f"Cost: ${s['unit_cost']} | Margin: {s['margin_pct']:.1%} | "
        f"Units/Mo: {s['avg_units_mo']} | Trend: {s['trend']} | Realization: {s.get('realization_rate',0.87):.0%}"
        for s in skus)
    ds_section = f"\nDS Model Tool Output (DemandModel-v2.1, run 2025-03-15):\n{ds_context}\n" if ds_context else ""
    return f"""Planner Blueprint:
---
{planner_output}
---
{ds_section}
SKU data:
{lines}

The DS model provides base recommendations. Apply the ambient macro signal delta (+4.8% composite) on top of the DS base to get the final proposed increase. If the DS model was run recently (within 90 days), weight it at 70% and macro signals at 30%.
Run the pricing pipeline and propose increases for all {len(skus)} SKUs.
Start with "🔨 BUILDER AGENT — PRICING PIPELINE" as header."""

def build_critic_prompt(skus, builder_output):
    lines = "\n".join(
        f"  {s['sku_id']} | Margin: {s['margin_pct']:.1%} | Units/Mo: {s['avg_units_mo']} | "
        f"Type: {s['type']} | Months since reprice: {s.get('months_since_reprice','?')} | "
        f"Realization: {s.get('realization_rate',0.87):.0%}" for s in skus)
    return f"""Builder's proposals:
---
{builder_output}
---
SKU guardrail data:
{lines}

Review every SKU against all guardrails G1–G8. Be specific about which rule fires.
Start with "🔍 CRITIC AGENT — GUARDRAIL REVIEW" as header."""

def build_executor_prompt(skus, project_name, approved_lines, ds_context=""):
    lines = "\n".join(
        f"  {s['sku_id']} | {s['product_name']} | LP: ${s['list_price']} | "
        f"Cost: ${s['unit_cost']} | Units/Mo: {s['avg_units_mo']} | Months since reprice: {s.get('months_since_reprice','?')}"
        for s in skus)
    return f"""Project: **{project_name}**

Human-approved price increase decisions:
{approved_lines}

DS Model context:
{ds_context}

SKU reference:
{lines}

The human pricing admin has reviewed and approved the above price increases (with overrides where applicable).
Your role: confirm the implementation plan, note any final risk observations, and state that prices are being applied.
Keep it concise — 3-5 bullet executive summary + one line per SKU confirming the applied %.
Start with "✅ EXECUTOR AGENT — IMPLEMENTING APPROVED PRICES" as header."""
# approved_lines (main.py): "\n".join(f"  {sid}: approved_pct={pct}%" for sid, pct in decisions.items())
# executor ds_context (main.py): "\n".join(f"  {sku_id}: {base_recommendation_pct}%")

def build_negotiation_prompt(user_message, history, executor_output, skus, preview_rows=None):
    if preview_rows:
        sku_ref = "\n".join(
            f"  {r['sku_id']} | {r.get('product_name','?')} | {r.get('sub_category','?')} | "
            f"LP:${r.get('current_lp',0):.2f} | DS:{r.get('ds_base_pct',0):.1f}% | "
            f"Macro:+{r.get('macro_delta_pct',0):.1f}% | Proposed:{r.get('proposed_pct',0):.1f}% | "
            f"Conf:{int(r.get('confidence',0)*100)}%"
            + (" | HARD BLOCK" if r.get('has_hard_block') else
               (f" | flags:{','.join(f['rule'] for f in r.get('guardrail_flags',[]))}" if r.get('guardrail_flags') else ""))
            for r in preview_rows)
    else:
        sku_ref = "\n".join(
            f"  {s['sku_id']} | {s['product_name']} | LP:${s['list_price']} | "
            f"Cost:${s['unit_cost']} | Margin:{s['margin_pct']:.1%} | Units/Mo:{s['avg_units_mo']}" for s in skus)
    history_text = "\n".join(f"{'Human' if m['role']=='user' else 'Agent'}: {m['content']}" for m in history[:-1])
    return f"""Context:
{executor_output[:1500]}

SKU data ({len(preview_rows) if preview_rows else len(skus)} SKUs):
{sku_ref}

History:
{history_text}

Human: {user_message}"""
```

> **History is duplicated, with an off-by-one.** For E22, the full history is sent as real chat messages **and** embedded as text, and the embedded copy drops the last item via `history[:-1]`. Since the frontend sends history *without* the new question, the most recent prior assistant reply is missing from the embedded text. Preserve this, or document it if you change it.
>
> In practice, `executor_output` for E22 is the **narrative summary** (or the placeholder "Committee pricing analysis not yet summarised."). It is not the Executor's output.

### 12.5 Summary prompt (E18, verbatim)

```text
You are summarising the output of an AI pricing committee for a B2B list-price review.
Write a concise 250-300 word executive summary for future reference, covering:
1. Market/cost context driving the repricing decision
2. Key SKU-level rationale and any notable exceptions
3. Risks and guardrail issues raised by the Critic
4. Overall portfolio impact
Write in past tense. Be specific and factual.

PLANNER:
{planner_text[:1800]}

BUILDER:
{builder_text[:2200]}

CRITIC:
{critic_text[:1200]}
```

### 12.6 Standalone negotiation system prompt (built client-side, negotiate page)

```js
const context = selectedSku
  ? `SKU ${id} (${product_name}): current LP $${current_lp.toFixed(2)}, proposed ${proposed_pct.toFixed(1)}% increase, DS base ${ds_base_pct.toFixed(1)}%, macro delta +${macro_delta_pct.toFixed(1)}%, trend: ${trend}, confidence: ${(confidence*100).toFixed(0)}%.`
  : "No SKU selected.";
const systemPrompt = `You are PriceMind AI, a pricing negotiation agent for Assa Abloy electromechanical products. Answer the user's question about price recommendations using the provided SKU context. Be concise, specific, and data-driven. Context: ${context}\n\nExecutor summary: ${executorText.slice(0, 500)}`;
```

### 12.7 AI failure behavior

| Failure | Backend | Frontend |
|---|---|---|
| LLM error during committee | generator raises; the stream ends; nothing persisted; status stays `running` | `onerror` → phase `idle` (partial text kept until next action) |
| LLM error during executor | stream ends; status stays `executing` | `onerror` → phase `awaiting_review`; on reload, `executing` → awaiting_review |
| LLM error in summarize | 500 | summary loading stops; no summary card |
| LLM error in negotiation | 404 is checked first; after streaming starts, an error truncates the stream (status already 200) | partial reply stays; the error message is shown only if `fetch` rejects or `!res.ok` |
| Empty LLM content | summary `""` | no summary card shown (`narrativeSummary` falsy) |

---

## 13. Database Schema and ER Diagram

### 13.1 Engine / session (`database.py`)

- `create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)`, created lazily on first use.
- `sessionmaker(autocommit=False, autoflush=False)`.
- `Base = DeclarativeBase`.
- `load_dotenv()` runs at import time.

### 13.2 Tables (`models.py`)

**projects**

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | String | PK | — | `"proj-" + 8 hex` |
| name | String | NOT NULL | — | |
| group_field | String | yes | `""` | always "custom" |
| group_value | String | yes | `""` | always "selection" |
| status | String | yes | `"pending"` | §11.8 |
| target_revenue | Float | yes | 0 | |
| start_date | String | yes | `""` | ISO `YYYY-MM-DD` as text |
| end_date | String | yes | `""` | "Review by" date |
| created_at | DateTime(tz) | yes | `server_default=func.now()` | list ordering |
| narrative_summary | Text | yes | NULL | |
| planner_output | Text | yes | NULL | |
| builder_output | Text | yes | NULL | |
| critic_output | Text | yes | NULL | |
| executor_output | Text | yes | NULL | |
| committee_last_run | DateTime(tz) | yes | NULL | set to `datetime.now(timezone.utc)` |

**project_skus**: composite PK (`project_id` FK→projects.id `ON DELETE CASCADE`, `sku_id` String). `sku_id` references the JSON catalog and has **no FK**. There's **no unique constraint on `sku_id` alone**; one-project-per-SKU is enforced only in application code, so it's race-prone.

**review_decisions**: `id` Integer PK autoincrement; `project_id` FK→projects.id `ON DELETE CASCADE` (nullable); `sku_id` String NOT NULL; `decision_pct` Float NOT NULL; `decided_at` DateTime(tz) `server_default now()`.

**pricing_history**: `id` Integer PK autoincrement; `project_id` String (**no FK**); `project_name`; `sku_id` NOT NULL; `product_name`; `old_lp`, `proposed_pct`, `final_pct`, `new_lp` Float; `applied_at` DateTime(tz) `server_default now()`. Write-only: nothing reads it.

ORM relationships: `Project.skus` and `Project.decisions` use `cascade="all, delete-orphan"`. There are no explicit indexes beyond the PKs. Soft delete and archival don't exist.

```mermaid
erDiagram
  PROJECTS ||--o{ PROJECT_SKUS : "has (cascade)"
  PROJECTS ||--o{ REVIEW_DECISIONS : "has (cascade)"
  PROJECTS ||..o{ PRICING_HISTORY : "logical only (no FK, survives delete)"
  CATALOG_SKU ||..o{ PROJECT_SKUS : "sku_id (JSON, no FK)"
  CATALOG_SKU ||..o{ REVIEW_DECISIONS : "sku_id"
  CATALOG_SKU ||..o{ PRICING_HISTORY : "sku_id"
  PROJECTS { string id PK; string name; string status; float target_revenue; string start_date; string end_date; datetime created_at; text narrative_summary; text planner_output; text builder_output; text critic_output; text executor_output; datetime committee_last_run }
  PROJECT_SKUS { string project_id PK,FK; string sku_id PK }
  REVIEW_DECISIONS { int id PK; string project_id FK; string sku_id; float decision_pct; datetime decided_at }
  PRICING_HISTORY { int id PK; string project_id; string project_name; string sku_id; string product_name; float old_lp; float proposed_pct; float final_pct; float new_lp; datetime applied_at }
  CATALOG_SKU { string sku_id; string product_name; float list_price; float unit_cost; float margin_pct; int avg_units_mo; string trend; float realization_rate; int months_since_reprice }
```

### 13.3 Migrations

There's no Alembic. On startup the app runs `create_all`, then these statements; each is wrapped in `try/except: pass` and committed individually:

```sql
ALTER TABLE projects ADD COLUMN planner_output TEXT;
ALTER TABLE projects ADD COLUMN builder_output TEXT;
ALTER TABLE projects ADD COLUMN critic_output TEXT;
ALTER TABLE projects ADD COLUMN executor_output TEXT;
ALTER TABLE projects ADD COLUMN committee_last_run TIMESTAMP WITH TIME ZONE;
```

> On PostgreSQL, a failed statement aborts the transaction. Each `conn.execute` that fails isn't rolled back before the next one runs. This works on SQLite [RUN]; on Postgres, whether a failure poisons the later statements is **[UNVERIFIED]**. A replica can use `ADD COLUMN IF NOT EXISTS`, or a proper migration tool, as a documented improvement.

### 13.4 Reference data (not in the DB): `backend/data/sku_data.json`

Top-level keys:
- `skus` (28).
- `history` (28 SKU → 6 series × 12 months).
- `macro_indicators` (8).
- `guardrails` (header row + 8).
- `component_map`: header row + 24 component rows for CFG-3001..3008, with fields `config_sku, config_name, component_id, component_name, cost_pct, est_cost, parent_lp`. `get_component_map()` exists but is **never called**.

Catalog composition:
- `category`: Deadlatch 13, Deadbolt 15.
- `sub_category`: Residential 10, Commercial 9, Smart Home 5, Institutional 2, Healthcare 1, Industrial 1.
- `type`: SKU 20, Configured 8.
- `trend`: Stable 12, Growing 11, Declining 5.
- `brand`: Yale 9, Sargent 6, Corbin Russwin 5, ABLOY 3, Arrow 3, Medeco 2.
- `business_group`: Door Hardware 20, Electronic Security 5, Specialty Security 3.
- `sku_id` prefixes: `DL-1001..1010`, `DB-2001..2010`, `CFG-3001..3008`.

**Copy this file byte-for-byte.** It's the only source of SKU data and is read-only at runtime (cached in a module-level global for the process lifetime).

### 13.5 Data flow summary

```
JSON catalog ──► /skus, /sku-assignments (with DB join) ──► user selects ──► projects + project_skus
     │
     └─► compute_ds_predictions ─► compute_preview ─► /preview ─► grid/KPIs
committee SSE ─► projects.{planner,builder,critic}_output, committee_last_run
summarize    ─► projects.narrative_summary
review-approve ─► review_decisions (replace-all), status review_complete
executor SSE ─► projects.executor_output
complete     ─► pricing_history rows (from review_decisions × catalog list_price), status complete
reset / PATCH(sku change) ─► clear outputs + review_decisions, status pending
delete       ─► cascade project_skus, review_decisions (pricing_history retained)
```

Transaction boundaries: one session per request, with a single `commit()` at the end of each mutating handler. Committee and executor persistence happen in a new session after streaming. The project's existence is checked before streaming but not re-checked atomically.

---

## 14. External Integrations and Dependencies

| Integration | Purpose | Mandatory? | Config | Auth | Failure behavior |
|---|---|---|---|---|---|
| **Configured LLM provider** (OpenAI-compatible API) | Committee, summary, executor, and negotiation calls; model configured by `OPENAI_MODEL` | Required for live LLM mode | `OPENAI_API_KEY` or a compatible provider key | Provider API key | §12.7 |
| **PostgreSQL** (prod) / any SQLAlchemy URL | Project persistence | **Required at startup** | `DATABASE_URL` (e.g. `postgresql://…`; SQLite `sqlite:///file.db` works) | in URL | startup `RuntimeError` if unset; request errors → 500 |
| Vercel | Frontend hosting | deploy only | `NEXT_PUBLIC_API_URL` (build-time) | — | — |
| Render (or Railway / Docker) | Backend hosting | deploy only | `PORT` (Dockerfile uses `${PORT:-8000}`) | — | — |

Not used: authentication providers, file storage, queues, workers, competitor/market data APIs (the "Trading Economics" source in the tool-call event is fictional/static), other agents or internal APIs.

**For Codex:** you won't have the original credentials. Provide your own OpenRouter key, or point the OpenAI-compatible client at another provider that serves an equivalent model and document the substitution. Use SQLite or a local Postgres for development.

---

## 15. Authentication, Authorization, and Security

### 15.1 Implemented model

- **Authentication:** none on the backend. The frontend "login" stores `{name:"Admin", role:"Pricing Admin", brand, avatar}` in `localStorage["pricemind_user"]`. There's no password, token, session, or expiry.
- **Authorization:** none. Every visitor is a "Pricing Admin". The Admin page's Read/Edit/Admin levels are cosmetic.
- **Route protection:** only the client `useEffect` redirect (§5.1). Every API endpoint is publicly callable.
- **CORS:** `*` for all origins and headers.
- **CSRF / rate limits / input sanitization:** none. React escapes rendered text. Agent output is rendered as plain text, not HTML or markdown, so there's no XSS sink.
- **Prompt injection surface:**
  - `POST /api/negotiate` accepts an **arbitrary system prompt** from the client. That makes it an open LLM proxy on the owner's OpenRouter key: an abuse and cost risk.
  - Project names and chat messages are interpolated into prompts unescaped.
- **Uploads:** none.

### 15.2 Security findings in the original repo (do not replicate)

1. `priceagent/backend/.env.example` is **tracked in git** and appears to contain a **real-looking OpenRouter API key** (value not reproduced here). **Rotate it, and use a placeholder in the replica's `.env.example`** (e.g. `OPENROUTER_API_KEY=your-openrouter-key`).
2. `priceagent/backend/.env` (untracked) holds `OPENROUTER_API_KEY` and `DATABASE_URL`. `priceagent/frontend/.env.local` (untracked) holds `NEXT_PUBLIC_API_URL`. `priceagent/.gitignore` correctly ignores `backend/.env` and `frontend/.env.local`.
3. The Admin page seeds a real personal name and email. Use placeholders.
4. The open `/api/negotiate` proxy (above).

### 15.3 Recommended (optional, document as deviation if added)

Restrict CORS to the frontend origin. Drop or harden `/api/negotiate` by building the system prompt server-side. Add basic rate limiting. None of these are required for parity.

---

## 16. Error Handling and Edge Cases

| Case | Backend (verified where marked) | Frontend behavior |
|---|---|---|
| Missing required body fields (create) | 422 pydantic list [RUN] | `detail` is an array here, so `new Error(detail)` stringifies it as `"[object Object],…"` and the new page would show `⚠ [object Object],…` **[INFERRED]**. The UI's required-field checks prevent this case anyway |
| end ≤ start (create/patch) | 422 "Review date must be after start date." [RUN] | prevented client-side; the edit modal would show the backend message |
| Start before today | not checked | blocked client-side (create only) |
| SKU already in a project (create) | 409 "SKU(s) X already assigned to project 'Name'" [RUN] | new page: red box; **dashboard modal: unhandled, stuck on "Creating…"** |
| SKU conflict on edit | 409 "…already belong to project '…'. A SKU can only be in one project." | inline error in the edit modal |
| Empty `sku_ids` | **accepted** (create and patch) [RUN] | blocked by UI |
| Unknown SKU id | accepted, stored, silently dropped on read | n/a |
| Duplicate SKU ids in one create | composite PK violation → 500 [INFERRED] | n/a (Set in UI) |
| Unknown project id | 404 "Project not found" on all `{pid}` routes [RUN] | workspace renders with an undefined project name [INFERRED]; no error screen |
| Unknown SKU in history | 404 "SKU not found" [RUN] | n/a |
| DB unreachable | 500 (unhandled) | most calls lack `.catch`: silent failure / unhandled promise |
| `GET /api/skus` fails | — | dashboard/new table stays empty; no message |
| Assignments fail | — | dashboard/new: treated as none locked (`{}`) |
| Committee SSE error / LLM down | stream aborts; status stays `running` | phase → idle; button re-enabled; no message |
| User closes the tab mid-committee | status `running`, outputs maybe not saved | on reopen: idle if no outputs, else awaiting_review |
| Stop Agents | none (server may keep generating until disconnect) | local reset + notification |
| Executor SSE error | status `executing` | phase → awaiting_review (decisions already saved) |
| `/complete` fails after the executor | status stays `executing` | UI shows complete; reload shows awaiting_review |
| Double submit | `/review-approve` replaces decisions (idempotent-ish) | guarded by the `submitting` flag (reset before the executor stream starts) |
| `/complete` called twice | duplicate history rows | called once per finish (guarded by `executorDone`) |
| Concurrent creates with the same SKU | race: both may pass the check (no unique index) | — |
| Override "0" or invalid | — | silently becomes proposed % |
| Override out of range | stored as-is | allowed |
| Negative revenue target | stored | `min=0` HTML hint only |
| Empty preview rows | portfolio zeros | grid shows the "Loading SKU data…" row indefinitely |
| Hard refresh on a protected page | — | redirect to `/` (§5.1) [INFERRED] |
| Negotiate page without sessionStorage | — | 0 SKUs, waterfall "Select a SKU to view waterfall" |
| localStorage unavailable | — | auth falls back to null; chat persistence errors are caught |
| Timezone | dates are naive strings; `committee_last_run` is UTC ISO | displayed with `toLocaleString()`; "today" = UTC date |
| Numeric precision | Python `round` half-even on floats; revenues are floats with `.0` | `toFixed` for display |

Logging and observability: none (uvicorn access logs only).

---

## 17. Environment Setup and Execution

### 17.1 Requirements

- Python 3.11. Node.js 20+ (the original ran on Node 25 / npm 11; Next 16 requires Node ≥ 20.9 **[INFERRED from Next 16 requirements]**).
- An OpenRouter API key (or a compatible provider).
- A database: PostgreSQL in production, or SQLite for local development.

### 17.2 Environment variables

| Name | Where | Required | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | backend `.env` | yes (startup) | LLM key |
| `DATABASE_URL` | backend `.env` | yes (startup) | SQLAlchemy URL, e.g. `postgresql://user:pass@host:5432/db` or `sqlite:///./pricemind.db` |
| `PORT` | backend runtime | no | used by the Dockerfile CMD (default 8000) |
| `NEXT_PUBLIC_API_URL` | frontend `.env.local` / Vercel build env | no (defaults to `http://localhost:8000`) | backend base URL, **inlined at build time** |
| `LLM_MODE` | backend (replica only) | no (default `live`) | `mock` swaps every LLM call for deterministic fake output and drops the key requirement. **Added for Codex; not in the original** (§22.3) |

### 17.3 Commands (verified from repo config)

```bash
# Backend
cd priceagent/backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000        # dev (from priceagent/package.json "dev:api")
# Docker
docker build -t pricemind-api . && docker run -p 8000:8000 --env-file .env pricemind-api
#   CMD: sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"

# Frontend
cd priceagent/frontend
npm install
npm run dev        # next dev → http://localhost:3000
npm run build      # next build
npm run start      # next start
npm run lint       # eslint  (currently: 6 errors, 15 warnings — see §18.1)

# Both at once (from priceagent/)
npm install && npm run dev    # concurrently "API,UI"
```

There's no test command, no type-check script (use `npx tsc --noEmit`), and no formatter config.

Ports: API on 8000, UI on 3000. Railway health check: `GET /api/skus` (30 s timeout, restart on failure).

Known setup issues:
- `start.bat` hard-codes a user-specific local path (redacted).
- The READMEs mention a legacy provider key and outdated pip packages. Ignore them.
- Missing `DATABASE_URL` or both `OPENAI_API_KEY` and `OPENROUTER_API_KEY` stops the backend from starting in live LLM mode.

---

## 18. Testing and Acceptance Criteria

### 18.1 Existing tests

**None.** There are no unit, API, component, or E2E tests, and no fixtures, mocks, or CI.

ESLint status [RUN]: 6 errors, 15 warnings.
- `react-hooks/set-state-in-effect` in Providers, the negotiate page, the workspace, the new page, and projects.
- `react/no-unescaped-entities` at workspace line 1128.
- Unused `openNegotiate`, missing-deps warnings, and unused-expression warnings.

`next build` was **not run**, to avoid modifying the working tree. Next 16's `next build` no longer runs ESLint, so lint errors probably don't block deployment **[INFERRED]**.

### 18.2 Required tests for the replica

1. **Pricing engine unit tests**, driven by `codex-kit/fixtures/golden_pricing.json`:
   - Reproduce §11.9 exactly for all 28 SKUs and both portfolio objects.
   - Assert that the synthetic G1 case matches: proposed capped at 8.0, `has_hard_block` true, and flags G1, G5, G6 in that order with exact messages.
   - Assert that G2, G3 and G7 are unreachable (§11.3).
2. **DS model:** the md5-based `h`, clamping, and confidence values for the 28 SKUs.
3. **API tests** (SQLite, LLM mocked): every row of §10 with its status codes and bodies, including 404/409/422, cascade delete, history retention, `sku_changed` reset, assignments, and E15 history rows (new_lp 44.62 / 33.08 / 56.11 for decisions 5.0 / 4.2 / 3.9 on DL-1001 / DL-1003 / DB-2001).
4. **SSE contract tests** (mock the LLM to yield fixed tokens): the event order and JSON keys in §10.3 E20/E21/E22, the 5 tool calls with computed counts, DB persistence after the stream, and status transitions.
5. **Prompt snapshot tests:** the builders' output for a fixed SKU set matches the templates in §12.4.
6. **Frontend component/E2E tests** (Playwright or similar, backend with a mocked LLM): the flows in §18.3.

### 18.3 Acceptance checklist

**Startup and build**
- [ ] With `DATABASE_URL=sqlite:///…` and a key set, the backend starts and creates 4 tables. `GET /api/skus` returns 28 items.
- [ ] Without `DATABASE_URL`, startup fails with "DATABASE_URL is not set. Add it to your .env file."
- [ ] `npm run build` succeeds. The UI uses `NEXT_PUBLIC_API_URL`, falling back to `http://localhost:8000`.

**Routes and navigation**
- [ ] All 10 routes in §5.1 exist. The Navbar links, active-state styling, dropdowns, and Sign out behave as in §7.0.
- [ ] Protected pages redirect to `/` when no user is stored.

**Login**
- [ ] Sign In is disabled until an org is picked. It redirects to `/dashboard` after about 600 ms. The user persists under the `pricemind_user` key.

**SKU Explorer**
- [ ] The filters cascade and reset downstream; changing a filter clears the selection.
- [ ] Three tabs with the exact columns. The color thresholds (margin <0.22 amber, realization <0.85 amber, months >12 red) apply.
- [ ] Locked SKUs are dimmed and unselectable. The badge navigates to the owning project. The "Show available only" toggle works.
- [ ] The total 12-mo revenue shows in $M to 1 dp. With all 28 SKUs it reads **$14.4M** (Σ`revenue_12mo` = 14,406,759) [RUN].
- [ ] The modal validates dates and creates the project, then redirects.

**New Project**
- [ ] Locked SKUs are sorted to the bottom with an orange badge. "Select all N available" picks unlocked filtered SKUs only.
- [ ] A 409 shows `⚠ {detail}`. The button labels change per state.

**Projects list**
- [ ] Status tabs and counts follow `displayStatus`. Skeleton, empty states, and hover Edit/Delete all work.
- [ ] Editing SKUs shows the amber reset warning and "Save & Reset Pricing". After save, the status is `pending` and outputs/decisions are cleared server-side.
- [ ] Delete removes the card. The SKUs become available. `pricing_history` remains.

**Workspace: committee**
- [ ] Run Agents opens SSE. The panels stream in order with an active border. The Builder shows 5 tool calls with the exact names, categories, and values. Each panel auto-scrolls.
- [ ] On Critic done: panels collapse, then the preview loads, the KPIs render, the summary card shows "Generating…" then text, the chat opens with 4 suggestions, and two notifications are added.
- [ ] After reload, `planner_output`, `builder_output`, `critic_output`, `committee_last_run`, and `narrative_summary` are restored, and the phase is awaiting_review.
- [ ] Stop Agents shows the modal and resets the UI. The status stays `running` server-side.

**Workspace: grid and decisions**
- [ ] Groups are keyed by `category||sub_category` with the average and uplift. Individual rows match §11.9 values.
- [ ] A group override hides individual inputs, and New LP shows "▲ grp". An individual override shows "▲ ovr".
- [ ] Submit sends decisions with the priority group > individual > proposed, and "0"/blank → proposed. The status becomes `review_complete`, then `executing` during the stream, then `complete` after `/complete`.
- [ ] The complete view shows Approved % with a ✓, or a purple diff when |Δ| ≥ 0.05.
- [ ] Price Manually: grid with all groups expanded, the "Manual Override Mode" pill, and the header shows "⚡ Run Agents".
- [ ] Reopen for Pricing: idle, outputs cleared, chat cleared, and `negotiate_chat_{id}` removed.

**Negotiation**
- [ ] Inline chat streams a reply. Enter sends; Shift+Enter adds a newline. History persists across reload. The request body matches §7.5.4.
- [ ] The network error message is exact.
- [ ] The full negotiate page renders the 3-column layout. With the original wiring it shows 0 SKUs (or, if fixed, the SKUs passed via sessionStorage; log as a deviation).

**API contract parity**
- [ ] Every endpoint in §10.1 exists with the same method, path, body, response keys, and status codes. Errors are `{"detail": …}`.
- [ ] SSE events use exactly `data: {json}\n\n` with the keys `agent`, `chunk`, `done`, `full`, `tool_call`, `phase`.

**Pricing logic parity**
- [ ] `compute_preview` matches §11.9 to the stated precision for every SKU, and both portfolio objects match exactly.

**Settings / Admin (UI-only)**
- [ ] The rule table has 8 default rules with toggle, add, edit, and delete. Autonomy shows all sub-categories defaulting to B. Saved toggles to "✅ Saved". Nothing persists after reload.
- [ ] Admin invite adds a "Invite Sent" row after about 600 ms. The System tab shows the exact strings.

**Responsive**
- [ ] At 400px: grids collapse to 1–2 columns as per the class lists. Tables scroll horizontally inside their containers. The navbar hides the brand badge, agent status, and user name below `sm`.

---

## 19. Codex Implementation Plan

### 19.1 Instructions for Codex (mandatory)

1. Treat **`PRICING_AGENT_SPEC.md` as the primary reference**. Inspect the target repository before changing anything.
2. Recreate **only the Pricing Agent (PriceMind AI)**. Do not build the portfolio site, blog, IPL predictor, `app.py` Flask demo, or the notebook.
3. Implement the **full stack**: the FastAPI backend (same routes, SSE contracts, ORM schema, startup migration), the Next.js 16 + React 19 + Tailwind v4 frontend (same routes, copy, classes, behaviors), and the OpenRouter integration.
4. **Preserve the visual design, flows, business rules, formulas, rounding, prompts, and API contracts.** Copy prompts and UI strings verbatim. Copy `backend/data/sku_data.json` **byte-for-byte**, and copy `app/globals.css` and `app/favicon.ico`.
5. Use the documented stack and versions. Don't add libraries such as state managers, UI kits, or ORMs. Unused original dependencies (radix, lucide, react-markdown, sse-starlette) may be included for manifest parity or omitted; record the choice.
6. **No hardcoded mock data where the original uses real calls.** The originally *simulated* parts stay simulated exactly as specified: the DS model, the tool-call events, the ambient Sales & Demand card, the macro panel on the dashboard, notifications, Settings, and Admin.
7. Keep secrets in env vars. Ship a placeholder `.env.example`. Never commit keys.
8. Implement the documented validation, error states, and persistence, including the intentional quirks. **Where you choose to fix a documented defect** (e.g. the persist-before-done race, the negotiate-page sessionStorage, dashboard modal error handling, the hard-refresh redirect), make the fix minimal, list it in a `DEVIATIONS.md`, and add a test.
9. Add the tests in §18.2 and run them, along with lint, type-check, and build. Fix failures in your own code.
10. Keep an implementation checklist and a blockers list in `IMPLEMENTATION_STATUS.md`, built from §2 and §18.3 (e.g. blocker: no LLM key available, so use `LLM_MODE=mock`).
11. When details are missing, make the smallest reasonable assumption, write it down, and continue. Don't stop for routine clarification.
12. **Never claim a feature works unless a test or a manual run has verified it.** State clearly which parts were verified with a mocked LLM and which with a real one.
13. **Use the Codex Execution Kit (§22):** `AGENTS.md`, `setup.sh`, the seven task prompts in `TASKS.md`, the `LLM_MODE=mock` contract, and the fixture `golden_pricing.json`. The kit's task order supersedes §19.2.

### 19.2 Suggested build order

1. Backend skeleton: `database.py`, `models.py`, the startup migration, CORS, `data_loader.py` with tests against the §11.9 golden values.
2. Data and CRUD endpoints (E1–E17, E19) with API tests.
3. `prompts.py` verbatim and an LLM client wrapper. SSE endpoints E20–E23 plus E18, with a mockable client.
4. Frontend shell: layout, globals, Providers, Navbar, `lib/api.ts`, `lib/auth.ts`, the login page.
5. Dashboard, New Project, Projects list (with modals).
6. Project Workspace: phases, SSE, grid, KPIs, ambient panel, summary, chat, executor.
7. Negotiate page, Settings, Admin, `/rules`, `/autonomy`.
8. E2E tests with a mocked LLM. Then a smoke test with a real key, if one is available.
9. Deployment configs: Dockerfile, `vercel.json` with `NEXT_PUBLIC_API_URL` as a build env.

---

## 20. Known Gaps, Assumptions, and Unresolved Questions

| # | Item | Status |
|---|---|---|
| 1 | No screen was visually inspected; layout and appearance are derived from code only | Unverified |
| 2 | Live LLM output was not exercised (dummy key); event *shapes* come from code | Code-verified |
| 3 | How Render deploys the backend (Docker vs native) and which DB provider is used | Unverified |
| 4 | How catalog `margin_pct` was computed (it isn't `1 - cost/LP`) | Unknown; preserve the data |
| 5 | Whether the Postgres startup ALTERs leave the transaction aborted on the first "column exists" error | Unverified |
| 6 | Whether `lg:grid-cols-${n}` (dynamic class) is emitted by Tailwind | Unverified |
| 7 | Hard-refresh redirect to `/` on protected pages | Inferred from React effect order |
| 8 | Committee-persistence race when the client closes on Critic done | Inferred |
| 9 | `/projects/[id]/negotiate` normally empty because `openNegotiate` is never called | Inferred (high confidence) |
| 10 | `HISTORICAL_INSIGHTS` keys never match the data, so insights never show | Code-verified |
| 11 | Negotiate-page trend color comparison uses lowercase values, so it's always gray | Code-verified |
| 12 | Autonomy `DEFAULT_TIER` keyed by category-like names, so every row is B | Code-verified |
| 13 | Executor `<RECOMMENDATIONS_JSON>` requested but never parsed; A/B/C routing never enforced | Code-verified |
| 14 | Settings rules have no effect on backend guardrails | Code-verified |
| 15 | Catalog list prices are never updated by "Prices Applied"; only `pricing_history` is written | Run-verified |
| 16 | Status stays `running` after a successful committee stream | Code-verified |
| 17 | SKUs remain locked after their project is complete | Run-verified |
| 18 | `pricing_history.proposed_pct` equals `final_pct` (the original proposal isn't stored) | Run-verified |
| 19 | `skus` order in `GET /api/projects` is nondeterministic | Run-verified |
| 20 | Tool-call "results" and Sales & Demand tiles are static and simulated | Code-verified |
| 21 | `PriceAgent_SKU_Data.xlsx` probably the source of `sku_data.json`; no conversion script | Inferred |
| 22 | README/START.md describe an older architecture | Code-verified |

---

## 21. Appendix: Relevant Files, Assets, Configuration, and Commands

### 21.1 File index

| File | Lines | Role |
|---|---|---|
| `priceagent/backend/main.py` | 660 | app, routes, SSE, migration, LLM client |
| `priceagent/backend/data_loader.py` | 151 | catalog loader, DS model, preview, guardrails |
| `priceagent/backend/agents/prompts.py` | 225 | prompts and builders |
| `priceagent/backend/models.py` | 63 | ORM |
| `priceagent/backend/database.py` | 31 | engine / session |
| `priceagent/backend/data/sku_data.json` | 98 KB | **required asset** |
| `priceagent/backend/requirements.txt`, `Dockerfile`, `railway.toml` | | runtime and deploy |
| `priceagent/frontend/app/projects/[id]/page.tsx` | 1,496 | workspace |
| `priceagent/frontend/app/projects/page.tsx` | 587 | list, edit, delete |
| `priceagent/frontend/app/dashboard/page.tsx` | 437 | SKU Explorer |
| `priceagent/frontend/app/projects/new/page.tsx` | 399 | new project |
| `priceagent/frontend/app/projects/[id]/negotiate/page.tsx` | 359 | full negotiation |
| `priceagent/frontend/app/settings/page.tsx` | 276 | settings (UI-only) |
| `priceagent/frontend/app/admin/page.tsx` | 229 | admin (UI-only) |
| `priceagent/frontend/app/autonomy/page.tsx` | 217 | orphan |
| `priceagent/frontend/app/rules/page.tsx` | 168 | orphan |
| `priceagent/frontend/components/Navbar.tsx` | 162 | navbar |
| `priceagent/frontend/components/Providers.tsx` | 68 | contexts |
| `priceagent/frontend/lib/api.ts` | 136 | API client |
| `priceagent/frontend/lib/auth.ts` | 34 | mock auth |
| `priceagent/frontend/app/page.tsx` | 91 | login |
| `priceagent/frontend/app/layout.tsx`, `globals.css` | 18 / 27 | shell / styles |
| `priceagent/frontend/vercel.json` | 10 | `{"framework":"nextjs","buildCommand":"npm run build","outputDirectory":".next","build":{"env":{"NEXT_PUBLIC_API_URL":"[REDACTED DEPLOYMENT URL]"}}}` |
| `priceagent/package.json` | 12 | concurrently dev runner |

### 21.2 Assets

- `app/favicon.ico` is the only image asset used (the default Next favicon).
- `public/{file,globe,next,vercel,window}.svg` are create-next-app leftovers and **not referenced**.
- Logos are CSS gradient boxes with letters; icons are emoji and inline Heroicons-style SVG paths. Copy the paths from `Navbar.tsx`: the gear, shield-check, bell, and chevron.

### 21.3 Browser storage keys

| Key | Storage | Content |
|---|---|---|
| `pricemind_user` | localStorage | `{"name":"Admin","role":"Pricing Admin","brand":"Assa Abloy","avatar":"AA"}` |
| `negotiate_chat_{projectId}` | localStorage | `[{"role":"user"\|"assistant","content":string}]` |
| `negotiate_{projectId}` | sessionStorage | `{"executorText":string,"rows":PreviewRow[]}` (read by the negotiate page; never written in the current code) |

### 21.4 Verification method used for this spec

- The backend ran in-process via FastAPI `TestClient`, with `DATABASE_URL` pointed at a temporary SQLite file outside the repo and `OPENROUTER_API_KEY` set to a dummy value. No LLM endpoints were streamed, and the production database was never touched.
- Exercised: E1–E19 (except E18 success), 404/409/422 paths, `pricing_history` writes, cascade behavior, and the full-catalog `compute_preview`.
- `npx eslint app components lib` ran on the frontend (read-only).
- No existing source, configuration, or data files in the repository were modified. The only additions are this spec and the `codex-kit/` folder.

---

## 22. Codex Execution Kit

This section turns the spec into something OpenAI Codex can run task by task. The kit lives in `codex-kit/` next to this file:

| File | Purpose |
|---|---|
| `codex-kit/README.md` | Human prep steps: what to copy into the new repo and how to configure the Codex environment |
| `codex-kit/AGENTS.md` | Standing instructions. Copy it to the **new repo root**; Codex reads `AGENTS.md` automatically |
| `codex-kit/setup.sh` | Idempotent environment setup script (pip, npm, Playwright browser) |
| `codex-kit/TASKS.md` | Seven ordered task prompts plus an optional live-LLM smoke test |
| `codex-kit/fixtures/golden_pricing.json` | Expected engine outputs, generated by running the original code [RUN] |

> `codex-kit/AGENTS.md` sits in a subfolder of *this* repo, so a Codex run against this repo applies it only to files under `codex-kit/`. It's a template for the new repo.

### 22.1 Why a kit is needed

- **Codex can't read this repository.** Assets that must be identical (`sku_data.json`, `globals.css`, `favicon.ico`) and the fixture have to be copied into the new repo before Task 1 (see `codex-kit/README.md`).
- **Dependencies are installed by a setup script.** The task itself may run with the network off, so installs belong in `setup.sh`, not in task prompts. Verify the current Codex behavior in its documentation.
- **A real LLM is usually unavailable during tasks** (no key, no network). The `LLM_MODE=mock` contract (§22.3) lets Codex build and test every streaming feature deterministically.
- **Bounded tasks with a clear "done when" command** produce more reliable results than one long build-everything prompt.

### 22.2 Target repository layout

The replica drops the `priceagent/` prefix. `backend/` and `frontend/` sit at the repo root; the full tree is in `codex-kit/AGENTS.md`. Paths in §3 and §21 map as `priceagent/backend/*` → `backend/*` and `priceagent/frontend/*` → `frontend/*`.

### 22.3 `LLM_MODE` contract (replica-only addition; record in `DEVIATIONS.md`)

All LLM access goes through one module, `backend/llm.py`, which exposes:

```python
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # Codex-assisted development; configurable runtime model.
async def stream_text(messages: list[dict], max_tokens: int) -> AsyncIterator[str]   # yields text deltas
async def complete_text(messages: list[dict], max_tokens: int) -> str                 # non-streaming
```

| `LLM_MODE` | Behavior |
|---|---|
| `live` (default) | `AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=OPENROUTER_API_KEY)`, the same calls and parameters as §12.1. Missing key → fail at startup, as the original does |
| `mock` | No network and no key required. Output is deterministic (below). `asyncio.sleep(0)` between chunks |

Mock output rules (deterministic, so tests can assert on them):
- Pick the header by matching the **system** message:

  | System prompt | Mock header |
  |---|---|
  | `PLANNER_SYSTEM` | `📋 PLANNER AGENT — PRICING BLUEPRINT` |
  | `BUILDER_SYSTEM` | `🔨 BUILDER AGENT — PRICING PIPELINE` |
  | `CRITIC_SYSTEM` | `🔍 CRITIC AGENT — GUARDRAIL REVIEW` |
  | `EXECUTOR_SYSTEM` | `✅ EXECUTOR AGENT — IMPLEMENTING APPROVED PRICES` |
  | `NEGOTIATION_SYSTEM` or any other system prompt | `Negotiation Agent (mock)` |
  | no system message (summary call) | `Executive summary (mock)` |

- Full text = `"{header}\n[mock] {first 80 chars of the last user message, newlines replaced by spaces}"`.
- `stream_text` yields that text split on single spaces, re-adding the space, in order.
- `complete_text` returns the whole string.
- `max_tokens` is accepted and ignored in mock mode.

Everything else stays the same in both modes: endpoints, SSE event shapes, persistence and timing sleeps. Only the text content differs.

### 22.4 Test tooling

- **Backend:** `pytest` and `httpx` (for FastAPI `TestClient`) in `requirements-dev.txt`. Use a temp SQLite file per test session and `LLM_MODE=mock`.
- **Frontend:** ESLint (existing config), `tsc --noEmit`, `next build`, and `@playwright/test` for E2E. The Playwright `webServer` config starts the backend (mock mode, SQLite) and the built frontend.
- **Fixture `golden_pricing.json`** keys:
  - `ds_predictions_all`, `preview_full_catalog`, `preview_project_3sku` (`{sku_ids, result}`), `preview_empty`
  - `synthetic_g1_case` (`{input_sku, hash_h, result}`)
  - `complete_history_case` (`{decisions, expected_new_lp}`)
  - `guardrail_reachability_any_input`
  - `catalog_total_revenue_12mo` (14406759)

  It was produced by importing the original `data_loader.py` and calling `compute_ds_predictions` and `compute_preview` directly. Compare numbers with exact equality; the engine has already rounded them.

### 22.5 Task sequence (summary of `codex-kit/TASKS.md`)

| Task | Scope | Spec sections | Done when |
|---|---|---|---|
| 1 | Backend foundation, ORM, pricing engine, `llm.py` | §3.2, §11, §13, §17, §22.3–22.4 | pytest (engine) passes |
| 2 | REST endpoints E1–E17, E19 + migration + CORS | §10, §11.4–11.8, §13.3, §15, §16 | pytest (API) passes |
| 3 | Prompts, SSE endpoints E20–E23, summary E18; **fix the persistence race** | §10.3, §12 | pytest (streams, prompt snapshots) passes |
| 4 | Frontend scaffold, Providers, Navbar, api/auth libs, login, route stubs | §5, §6, §7.0–7.1, §8 | lint + tsc + build pass |
| 5 | Explorer, New Project, Projects list; **fix dashboard modal error handling** | §7.2–7.4, §9, §11.5–11.6 | lint + tsc + build pass |
| 6 | Project Workspace; **fix the negotiate hand-off** | §7.5, §11.4, §11.7, §12.2, §16 | lint + tsc + build pass |
| 7 | Negotiate, Settings, Admin, orphans; Playwright E2E | §7.6–7.9, §18.3 | `npx playwright test` passes |
| 8 (optional) | Live-LLM smoke test | §18.3 | manual report |

The three fixes named in the table are the **only** deviations the kit asks for, plus the `LLM_MODE` addition. Every other quirk in §20 is reproduced as-is.
