"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, Project } from "@/lib/api";

type UserProfile = { name: string; role: string; organization: string; avatar: string };
type Theme = "dark" | "light";

function projectNotice(project: Project): { title: string; detail: string } {
  switch (project.status) {
    case "running": return { title: "Pricing committee is running", detail: `${project.skus?.length ?? 0} SKUs are being reviewed.` };
    case "review_complete": return { title: "Pricing decisions are ready", detail: `${project.name} is ready for your review.` };
    case "executing": return { title: "Prices are being executed", detail: `${project.name} has been approved.` };
    case "complete": return { title: "Pricing execution completed", detail: `${project.name} is complete.` };
    case "approved": return { title: "Project approved for execution", detail: `${project.name} is ready to proceed.` };
    default: return { title: "Project ready to launch", detail: `${project.name} is waiting to be started.` };
  }
}

function BellIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
}

export function Navbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile>({ name: "Admin", role: "Pricing Admin", organization: "Organization 1", avatar: "PG" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("priceguardrail_user");
      if (saved) {
        const user = JSON.parse(saved) as { name?: string; role?: string; brand?: string; avatar?: string };
        setProfile({ name: user.name || "Admin", role: user.role || "Pricing Admin", organization: user.brand || "Organization 1", avatar: user.avatar || "PG" });
      }
      const storedTheme = localStorage.getItem("priceguardrail_theme");
      if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
      const storedRead = localStorage.getItem("priceguardrail_read_notifications");
      if (storedRead) setReadIds(JSON.parse(storedRead) as string[]);
    } catch {
      localStorage.removeItem("priceguardrail_user");
    }
    api.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("priceguardrail_theme", theme);
  }, [theme]);

  const notices = useMemo(() => projects.map((project) => ({
    project,
    id: `${project.id}:${project.status}`,
    ...projectNotice(project),
  })), [projects]);
  const unreadCount = notices.filter((notice) => !readIds.includes(notice.id)).length;

  function markAllRead() {
    const allRead = notices.map((notice) => notice.id);
    setReadIds(allRead);
    localStorage.setItem("priceguardrail_read_notifications", JSON.stringify(allRead));
  }

  function toggleNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) api.projects().then(setProjects).catch(() => undefined);
  }

  return (
    <header className="topbar">
      <Link className="brand" href="/dashboard" aria-label="PriceGuardrail AI home">
        <span className="brand-mark">PG</span>
        <span>PriceGuardrail <b>AI</b></span>
      </Link>
      <span className="organization-chip">Organization 1</span>
      <nav className="nav-links" aria-label="Main navigation">
        <Link className={pathname === "/dashboard" ? "active" : ""} href="/dashboard">SKU Explorer</Link>
        <Link className={pathname.startsWith("/projects") ? "active" : ""} href="/projects">Pricing Projects</Link>
        <Link className={pathname === "/settings" ? "active" : ""} href="/settings">Settings</Link>
        <Link className={pathname === "/admin" ? "active" : ""} href="/admin">Admin</Link>
      </nav>
      <div className="nav-user">
        <button className="theme-button" type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? <span aria-hidden="true">☼</span> : <span aria-hidden="true">☾</span>}
        </button>
        <div className="nav-popover-wrap">
          <button className="notification-button" type="button" onClick={toggleNotifications} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={notificationsOpen}>
            <BellIcon />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
          {notificationsOpen && <section className="nav-popover notifications-popover" aria-label="Notifications">
            <div className="popover-heading"><strong>Notifications</strong><button type="button" className="mark-read-button" onClick={markAllRead} disabled={!unreadCount}>Mark all read</button></div>
            {notices.length === 0 ? <p className="popover-empty">No pricing project notifications yet.</p> : <div className="notification-list">{notices.map(({ project, id, title, detail }) => <Link className={`notification-item ${readIds.includes(id) ? "is-read" : ""}`} key={id} href={`/projects/${project.id}`} onClick={() => { setReadIds((current) => { const next = [...new Set([...current, id])]; localStorage.setItem("priceguardrail_read_notifications", JSON.stringify(next)); return next; }); setNotificationsOpen(false); }}>
              <span className={`notification-dot status-${project.status}`} />
              <span className="notification-copy"><strong>{title}</strong><small>{detail}</small><time>{project.name}</time></span>
            </Link>)}</div>}
            <Link className="popover-footer" href="/projects" onClick={() => setNotificationsOpen(false)}>View pricing projects</Link>
          </section>}
        </div>
        <div className="nav-popover-wrap">
          <button className="profile-button" type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
            <span className="profile-avatar">{profile.avatar}</span><span className="profile-copy"><strong>{profile.name}</strong><small>{profile.role}</small></span><span className="profile-chevron" aria-hidden="true">⌄</span>
          </button>
          {profileOpen && <section className="nav-popover profile-popover" aria-label="User profile"><strong>{profile.name}</strong><span>{profile.role}</span><small>{profile.organization}</small><Link className="popover-footer" href="/settings" onClick={() => setProfileOpen(false)}>Profile &amp; settings</Link></section>}
        </div>
      </div>
    </header>
  );
}
