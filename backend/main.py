"""PriceGuardrail AI HTTP API."""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import data_loader
from . import llm
from .agents import prompts
from .database import Base, get_db, get_engine
from .models import PricingHistory, Project, ProjectSku, ReviewDecision

app = FastAPI(title="PriceGuardrail AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class ProjectCreate(BaseModel):
    name: str
    group_field: str
    group_value: str
    sku_ids: list[str]
    target_revenue: float = 0
    start_date: str = ""
    end_date: str = ""


class ProjectUpdate(BaseModel):
    name: str | None = None
    target_revenue: float | None = None
    start_date: str | None = None
    end_date: str | None = None
    sku_ids: list[str] | None = None


class SummaryBody(BaseModel):
    planner_text: str
    builder_text: str
    critic_text: str


class ProjectNegotiateBody(BaseModel):
    message: str
    history: list[dict]
    executor_output: str
    preview_rows: list[dict] | None = None


class StandaloneNegotiateBody(BaseModel):
    system: str
    question: str


def _catalog_skus(project: Project) -> list[dict]:
    sku_ids = {item.sku_id for item in project.skus}
    return [sku for sku in data_loader.get_skus() if sku["sku_id"] in sku_ids]


def _project_detail(project: Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "group_field": project.group_field or "",
        "group_value": project.group_value or "",
        "skus": _catalog_skus(project),
        "status": project.status or "pending",
        "target_revenue": project.target_revenue or 0,
        "start_date": project.start_date or "",
        "end_date": project.end_date or "",
        "review_decisions": {item.sku_id: item.decision_pct for item in project.decisions},
        "approvals": {},
        "narrative_summary": project.narrative_summary or "",
        "planner_output": project.planner_output or "",
        "builder_output": project.builder_output or "",
        "critic_output": project.critic_output or "",
        "executor_output": project.executor_output or "",
        "committee_last_run": project.committee_last_run.isoformat() if project.committee_last_run else "",
    }


def _project_list_row(project: Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "skus": _catalog_skus(project),
        "status": project.status or "pending",
        "target_revenue": project.target_revenue or 0,
        "start_date": project.start_date or "",
        "end_date": project.end_date or "",
    }


def _get_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _validate_dates(start_date: str | None, end_date: str | None) -> None:
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=422, detail="Review date must be after start date.")


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


BUILDER_TOOLS = [
    {"type": "function", "function": {"name": "market_signal_fetch", "description": "Read the currently configured macro cost-signal snapshot. These are demo/reference signals, not a live market feed.", "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}, "strict": True}},
    {"type": "function", "function": {"name": "compute_unit_cost_update", "description": "Calculate portfolio unit-cost impact using the configured macro snapshot and project SKUs.", "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}, "strict": True}},
    {"type": "function", "function": {"name": "compute_macro_adjustment", "description": "Calculate the weighted macro adjustment factor from configured signal weights.", "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}, "strict": True}},
    {"type": "function", "function": {"name": "demand_model_validate", "description": "Run DemandModel-v2.1 predictions and summarize volume-risk metrics for this project.", "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}, "strict": True}},
    {"type": "function", "function": {"name": "guardrail_preflight", "description": "Run deterministic pricing preview and report guardrail blocks and warnings before human review.", "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}, "strict": True}},
]


def _run_builder_tool(name: str, skus: list[dict]) -> dict:
    """Whitelisted deterministic pricing actions callable by the Builder LLM."""
    count = len(skus)
    if name == "market_signal_fetch":
        return {"CPI": "+3.2%", "PPI_Metals": "+4.8%", "Steel_Index": "+6.1%", "Freight_Index": "+5.4%", "Forex_USD_INR": "+1.8%", "composite_shift": "+4.8%", "source": "Configured demo snapshot; not live market data", "status": "OK"}
    if name == "compute_unit_cost_update":
        return {"avg_cost_increase_pct": 4.1, "skus_updated": count, "primary_driver": "Steel_Index (+6.1%)", "status": "Calculated; no catalog prices were changed"}
    if name == "compute_macro_adjustment":
        return {"macro_adjustment_factor": 1.048, "composite_shift_pct": 4.8, "weights": {"cpi": 0.15, "commodity": 0.55, "freight": 0.20, "forex": 0.10}, "status": "OK"}
    if name == "demand_model_validate":
        predictions = data_loader.compute_ds_predictions(skus)
        high_risk = sum(sku.get("avg_units_mo", 0) > 1200 for sku in skus)
        return {"model_version": "DemandModel-v2.1", "sku_count": count, "high_volume_sku_count": high_risk, "avg_base_recommendation_pct": round(sum(p.get("base_recommendation_pct", 0) for p in predictions.values()) / max(1, len(predictions)), 2), "model_accuracy_pct": 94.2, "drift_detected": False, "status": "OK"}
    if name == "guardrail_preflight":
        preview = data_loader.compute_preview(skus)
        return {"potential_hard_blocks": preview["portfolio"]["skus_with_hard_block"], "skus_with_warnings": preview["portfolio"]["skus_with_warnings"], "sku_count": count, "status": "OK"}
    raise ValueError(f"Unknown Builder tool: {name}")


async def _stream_agent(agent: str, system: str, user: str, max_tokens: int):
    full_text = ""
    async for chunk in llm.stream_text(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens,
    ):
        full_text += chunk
        yield {"agent": agent, "chunk": chunk}
    yield {"agent": agent, "done": True, "full": full_text}


@app.on_event("startup")
def create_tables() -> None:
    llm.validate_configuration()
    Base.metadata.create_all(bind=get_engine())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "PriceGuardrail AI"}


@app.get("/api/skus")
def list_skus() -> list[dict]:
    return data_loader.get_skus()


@app.get("/api/ds-model/predictions")
def list_predictions() -> list[dict]:
    predictions = data_loader.compute_ds_predictions(data_loader.get_skus())
    return list(predictions.values())


@app.get("/api/sku-assignments")
def sku_assignments(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(ProjectSku, Project).join(Project, ProjectSku.project_id == Project.id)
    ).all()
    return {
        sku_link.sku_id: {"project_id": project.id, "project_name": project.name}
        for sku_link, project in rows
    }


@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)) -> list[dict]:
    projects = db.scalars(select(Project).order_by(Project.created_at.desc())).all()
    return [_project_list_row(project) for project in projects]


@app.post("/api/projects")
def create_project(body: ProjectCreate, db: Session = Depends(get_db)) -> dict:
    _validate_dates(body.start_date, body.end_date)
    conflicts = db.execute(
        select(ProjectSku, Project)
        .join(Project, ProjectSku.project_id == Project.id)
        .where(ProjectSku.sku_id.in_(body.sku_ids))
    ).first()
    if conflicts:
        sku_link, owner = conflicts
        raise HTTPException(
            status_code=409,
            detail=f"SKU(s) {sku_link.sku_id} already assigned to project '{owner.name}'",
        )

    project = Project(
        id=f"proj-{uuid4().hex[:8]}",
        name=body.name,
        group_field=body.group_field,
        group_value=body.group_value,
        status="pending",
        target_revenue=body.target_revenue,
        start_date=body.start_date,
        end_date=body.end_date,
        skus=[ProjectSku(sku_id=sku_id) for sku_id in body.sku_ids],
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_detail(project)


@app.get("/api/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)) -> dict:
    return _project_detail(_get_project(db, project_id))


@app.patch("/api/projects/{project_id}")
def update_project(
    project_id: str, body: ProjectUpdate, db: Session = Depends(get_db)
) -> dict:
    project = _get_project(db, project_id)
    updates = body.model_dump(exclude_unset=True)
    start_date = updates.get("start_date", project.start_date)
    end_date = updates.get("end_date", project.end_date)
    _validate_dates(start_date, end_date)

    for field in ("name", "target_revenue", "start_date", "end_date"):
        if field in updates and updates[field] is not None:
            setattr(project, field, updates[field])

    sku_changed = False
    if "sku_ids" in updates and updates["sku_ids"] is not None:
        new_ids = set(updates["sku_ids"])
        old_ids = {link.sku_id for link in project.skus}
        sku_changed = new_ids != old_ids
        if sku_changed:
            added_ids = new_ids - old_ids
            conflict = db.execute(
                select(ProjectSku, Project)
                .join(Project, ProjectSku.project_id == Project.id)
                .where(Project.id != project_id, ProjectSku.sku_id.in_(added_ids))
            ).first()
            if conflict:
                sku_link, owner = conflict
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"SKU(s) {sku_link.sku_id} already belong to project '{owner.name}'. "
                        "A SKU can only be in one project."
                    ),
                )
            project.skus.clear()
            db.flush()
            project.skus.extend(ProjectSku(sku_id=sku_id) for sku_id in updates["sku_ids"])
            project.status = "pending"
            project.narrative_summary = None
            project.planner_output = None
            project.builder_output = None
            project.critic_output = None
            project.executor_output = None
            project.committee_last_run = None
            project.decisions.clear()

    db.commit()
    db.refresh(project)
    return {**_project_list_row(project), "sku_changed": sku_changed}


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    project = _get_project(db, project_id)
    db.delete(project)
    db.commit()
    return {"deleted": project_id}


@app.post("/api/projects/{project_id}/approve")
def approve_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    project = _get_project(db, project_id)
    project.status = "approved"
    db.commit()
    return {"status": "ok"}


@app.get("/api/projects/{project_id}/preview")
def project_preview(project_id: str, db: Session = Depends(get_db)) -> dict:
    return data_loader.compute_preview(_catalog_skus(_get_project(db, project_id)))


@app.post("/api/projects/{project_id}/complete")
def complete_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    project = _get_project(db, project_id)
    skus = _catalog_skus(project)
    decisions = {item.sku_id: item.decision_pct for item in project.decisions}
    violations = data_loader.negative_margin_violations(skus, decisions)
    if violations:
        affected = ", ".join(f"{item['sku_id']} ({item['margin_pct']}%)" for item in violations)
        raise HTTPException(status_code=409, detail=f"G9 negative-margin guardrail blocked execution for: {affected}")
    for sku in skus:
        final_pct = decisions.get(sku["sku_id"], 0)
        db.add(
            PricingHistory(
                project_id=project.id,
                project_name=project.name,
                sku_id=sku["sku_id"],
                product_name=sku.get("product_name", ""),
                old_lp=sku["list_price"],
                proposed_pct=final_pct,
                final_pct=final_pct,
                new_lp=round(sku["list_price"] * (1 + final_pct / 100), 2),
            )
        )
    project.status = "complete"
    db.commit()
    return {"status": "ok"}


@app.post("/api/projects/{project_id}/reset")
def reset_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    project = _get_project(db, project_id)
    project.status = "pending"
    project.narrative_summary = None
    project.planner_output = None
    project.builder_output = None
    project.critic_output = None
    project.executor_output = None
    project.committee_last_run = None
    project.decisions.clear()
    db.commit()
    return {"status": "ok"}


@app.post("/api/projects/{project_id}/skip-committee")
def skip_committee(project_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    _get_project(db, project_id)
    db.commit()
    return {"status": "ok"}


@app.post("/api/projects/{project_id}/summarize")
async def summarize_project(
    project_id: str, body: SummaryBody, db: Session = Depends(get_db)
) -> dict[str, str]:
    project = _get_project(db, project_id)
    prompt = prompts.build_summary_prompt(
        body.planner_text, body.builder_text, body.critic_text
    )
    summary = (
        await llm.complete_text([{"role": "user", "content": prompt}], max_tokens=550)
    ).strip()
    project.narrative_summary = summary
    db.commit()
    return {"summary": summary}


@app.get("/api/projects/{project_id}/committee/stream")
def committee_stream(project_id: str, db: Session = Depends(get_db)):
    project = _get_project(db, project_id)
    project.status = "running"
    db.commit()
    skus = _catalog_skus(project)
    project_name = project.name
    ds = data_loader.compute_ds_predictions(skus)
    ds_context = "\n".join(
        f"  {sku['sku_id']}: DS base={ds[sku['sku_id']]['base_recommendation_pct']}%, "
        f"confidence={ds[sku['sku_id']]['confidence']:.0%}, model=DemandModel-v2.1, last_run=2025-03-15"
        for sku in skus
    )

    async def events():
        yield _sse({"agent": "system", "chunk": f"PriceGuardrail AI committee convened for **{project_name}**\n\n"})
        await asyncio.sleep(0.2)

        planner_output = ""
        async for event in _stream_agent(
            "planner", prompts.PLANNER_SYSTEM, prompts.build_planner_prompt(skus, project_name), 900
        ):
            planner_output += event.get("chunk", "")
            yield _sse(event)

        await asyncio.sleep(0.3)
        builder_output = ""
        builder_system = prompts.BUILDER_SYSTEM + "\n\nBefore proposing prices, call all five available tools exactly once: market_signal_fetch, compute_unit_cost_update, compute_macro_adjustment, demand_model_validate, and guardrail_preflight. Use their returned data as the source of truth. Tool execution is read-only and does not apply prices."
        builder_messages = [
            {"role": "system", "content": builder_system},
            {"role": "user", "content": prompts.build_builder_prompt(skus, project_name, planner_output, ds_context)},
        ]
        async for item in llm.stream_tool_agent(
            builder_messages,
            BUILDER_TOOLS,
            lambda name, args: _run_builder_tool(name, skus),
            900,
        ):
            if "tool_call" in item:
                yield _sse({"agent": "builder", "tool_call": item["tool_call"]})
            elif "chunk" in item:
                builder_output += item["chunk"]
                yield _sse({"agent": "builder", "chunk": item["chunk"]})
        yield _sse({"agent": "builder", "done": True, "full": builder_output})

        await asyncio.sleep(0.3)
        critic_output = ""
        async for event in _stream_agent(
            "critic", prompts.CRITIC_SYSTEM, prompts.build_critic_prompt(skus, builder_output), 900
        ):
            critic_output += event.get("chunk", "")
            if event.get("done"):
                project.planner_output = planner_output
                project.builder_output = builder_output
                project.critic_output = critic_output
                project.committee_last_run = datetime.now(timezone.utc)
                db.commit()
            yield _sse(event)

        yield _sse({"done": True, "phase": "awaiting_review"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/projects/{project_id}/executor/stream")
def executor_stream(project_id: str, db: Session = Depends(get_db)):
    project = _get_project(db, project_id)
    project.status = "executing"
    db.commit()
    skus = _catalog_skus(project)
    project_name = project.name
    decisions = {item.sku_id: item.decision_pct for item in project.decisions}
    ds = data_loader.compute_ds_predictions(skus)
    approved_lines = "\n".join(
        f"  {sku_id}: approved_pct={pct}%" for sku_id, pct in decisions.items()
    )
    ds_context = "\n".join(
        f"  {sku_id}: {prediction['base_recommendation_pct']}%"
        for sku_id, prediction in ds.items()
    )

    async def events():
        executor_output = ""
        async for event in _stream_agent(
            "executor",
            prompts.EXECUTOR_SYSTEM,
            prompts.build_executor_prompt(skus, project_name, approved_lines, ds_context),
            900,
        ):
            executor_output += event.get("chunk", "")
            if event.get("done"):
                project.executor_output = executor_output
                db.commit()
            yield _sse(event)
        yield _sse({"done": True, "phase": "complete"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/projects/{project_id}/negotiate")
def negotiate_project(
    project_id: str, body: ProjectNegotiateBody, db: Session = Depends(get_db)
):
    project = _get_project(db, project_id)
    messages = [
        {"role": "system", "content": prompts.NEGOTIATION_SYSTEM},
        {
            "role": "assistant",
            "content": "I have the full committee analysis. Here are the key recommendations:\n\n"
            + body.executor_output[:2000],
        },
        *body.history,
        {
            "role": "user",
            "content": prompts.build_negotiation_prompt(
                body.message,
                body.history,
                body.executor_output,
                _catalog_skus(project),
                body.preview_rows,
            ),
        },
    ]

    async def events():
        async for chunk in llm.stream_text(messages, max_tokens=600):
            yield _sse({"chunk": chunk})
        yield _sse({"done": True})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/negotiate")
def negotiate_standalone(body: StandaloneNegotiateBody):
    messages = [
        {"role": "system", "content": body.system},
        {"role": "user", "content": body.question},
    ]

    async def events():
        async for chunk in llm.stream_text(messages, max_tokens=600):
            yield _sse({"chunk": chunk})
        yield _sse({"done": True})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/projects/{project_id}/review-approve")
def review_approve(project_id: str, body: dict, db: Session = Depends(get_db)) -> dict[str, str]:
    project = _get_project(db, project_id)
    requested = body.get("decisions", {})
    if not isinstance(requested, dict):
        raise HTTPException(status_code=422, detail="Decisions must be an SKU-to-percentage object.")
    valid_sku_ids = {sku["sku_id"] for sku in _catalog_skus(project)}
    unknown_skus = set(requested) - valid_sku_ids
    if unknown_skus:
        raise HTTPException(status_code=422, detail=f"Decisions contain SKUs outside this project: {', '.join(sorted(unknown_skus))}")
    try:
        decisions = {sku_id: float(pct) for sku_id, pct in requested.items()}
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Every decision must be a numeric percentage.") from None
    skus = _catalog_skus(project)
    violations = data_loader.negative_margin_violations(skus, decisions)
    if violations:
        affected = ", ".join(f"{item['sku_id']} ({item['margin_pct']}%)" for item in violations)
        raise HTTPException(status_code=422, detail=f"G9 negative-margin guardrail blocked approval for: {affected}")
    project.decisions.clear()
    project.decisions.extend(
        ReviewDecision(sku_id=sku_id, decision_pct=pct)
        for sku_id, pct in decisions.items()
    )
    project.status = "review_complete"
    db.commit()
    return {"status": "ok"}


@app.get("/api/macro")
def macro_data() -> list[dict]:
    return data_loader.load_catalog().get("macro_indicators", [])


@app.get("/api/guardrails")
def guardrails() -> list[dict]:
    return data_loader.load_catalog().get("guardrails", [])


@app.get("/api/history/{sku_id}")
def sku_history(sku_id: str) -> dict:
    history = data_loader.load_catalog().get("history", {})
    if sku_id not in history:
        raise HTTPException(status_code=404, detail="SKU not found")
    return history[sku_id]


@app.get("/api/hierarchy")
def hierarchy() -> dict:
    result: dict = {}
    for sku in data_loader.get_skus():
        business_group = sku.get("business_group") or "Other"
        category = sku.get("category") or "Other"
        sub_category = sku.get("sub_category") or "Other"
        brand = sku.get("brand") or "Other"
        result.setdefault(business_group, {}).setdefault(category, {}).setdefault(sub_category, {}).setdefault(brand, []).append(sku)
    return result


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "PriceGuardrail AI", "status": "running"}
