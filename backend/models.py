"""Database schema for pricing projects and applied price history."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    group_field: Mapped[str | None] = mapped_column(String, default="")
    group_value: Mapped[str | None] = mapped_column(String, default="")
    status: Mapped[str | None] = mapped_column(String, default="pending")
    target_revenue: Mapped[float | None] = mapped_column(Float, default=0)
    start_date: Mapped[str | None] = mapped_column(String, default="")
    end_date: Mapped[str | None] = mapped_column(String, default="")
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    narrative_summary: Mapped[str | None] = mapped_column(Text)
    planner_output: Mapped[str | None] = mapped_column(Text)
    builder_output: Mapped[str | None] = mapped_column(Text)
    critic_output: Mapped[str | None] = mapped_column(Text)
    executor_output: Mapped[str | None] = mapped_column(Text)
    committee_last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    skus: Mapped[list["ProjectSku"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    decisions: Mapped[list["ReviewDecision"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectSku(Base):
    __tablename__ = "project_skus"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    sku_id: Mapped[str] = mapped_column(String, primary_key=True)
    project: Mapped[Project] = relationship(back_populates="skus")


class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    sku_id: Mapped[str] = mapped_column(String, nullable=False)
    decision_pct: Mapped[float] = mapped_column(Float, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    project: Mapped[Project | None] = relationship(back_populates="decisions")


class PricingHistory(Base):
    __tablename__ = "pricing_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    sku_id: Mapped[str] = mapped_column(String, nullable=False)
    product_name: Mapped[str] = mapped_column(String, nullable=False)
    old_lp: Mapped[float] = mapped_column(Float, nullable=False)
    proposed_pct: Mapped[float] = mapped_column(Float, nullable=False)
    final_pct: Mapped[float] = mapped_column(Float, nullable=False)
    new_lp: Mapped[float] = mapped_column(Float, nullable=False)
    applied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
