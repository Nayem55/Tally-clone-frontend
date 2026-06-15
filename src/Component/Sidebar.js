import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Search,
  PanelLeftClose,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { sidebarChildShortcuts, sidebarParentShortcuts } from "../utils/shortcuts";
import { hasActiveNode, menuTree } from "../utils/navigationTree";
import {
  EMPLOYEE_SESSION_TOKEN_KEY,
  filterNavigationByRole,
  readStoredUser,
} from "../utils/accessControl";

function openTreePath(nodeKey, setOpenKeys) {
  if (!nodeKey) return;
  setOpenKeys((current) => ({
    ...current,
    [nodeKey]: true,
  }));
}

function ShortcutBadge({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-500",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex min-w-[54px] justify-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function flattenNavigationEntries(nodes, trail = []) {
  return nodes.flatMap((node) => {
    const nextTrail = [...trail, node.label];
    const current = node.to
      ? [
          {
            label: node.label,
            to: node.to,
            trail: nextTrail,
          },
        ]
      : [];

    if (!Array.isArray(node.children) || node.children.length === 0) {
      return current;
    }

    return [...current, ...flattenNavigationEntries(node.children, nextTrail)];
  });
}

function TreeNode({
  node,
  depth = 0,
  pathname,
  openKeys,
  setOpenKeys,
  nodeKey,
  shortcutBadges,
  activeShortcutTarget,
  registerNodeRef,
}) {
  const active = hasActiveNode(node, pathname);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isOpen = hasChildren && (openKeys[nodeKey] ?? active);
  const badge = shortcutBadges[node.to || nodeKey];
  const shortcutSelected = activeShortcutTarget === nodeKey || activeShortcutTarget === node.to;

  if (!hasChildren) {
    return (
      <Link
        to={node.to}
        ref={(element) => registerNodeRef(node.to, element)}
        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition ${
          active
            ? "bg-blue-600 text-white shadow-sm"
            : shortcutSelected
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
        style={{ marginLeft: depth === 0 ? 0 : depth * 10 }}
      >
        <span>{node.label}</span>
        {badge ? (
          <ShortcutBadge tone={active || shortcutSelected ? "amber" : "slate"}>
            {badge}
          </ShortcutBadge>
        ) : null}
      </Link>
    );
  }

  return (
    <div>
      <button
        ref={(element) => registerNodeRef(nodeKey, element)}
        type="button"
        onClick={() =>
          setOpenKeys((current) => ({
            ...current,
            [nodeKey]: !(current[nodeKey] ?? active),
          }))
        }
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          active
            ? "bg-blue-50 text-blue-700"
            : shortcutSelected
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
              : "text-slate-700 hover:bg-slate-100"
        }`}
        style={{ marginLeft: depth === 0 ? 0 : depth * 10 }}
      >
        <span className="flex items-center gap-2">
          <span>{node.label}</span>
          {badge ? (
            <ShortcutBadge tone={active || shortcutSelected ? "amber" : "slate"}>
              {badge}
            </ShortcutBadge>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {isOpen ? (
        <div className="mt-1 space-y-1 border-l border-slate-200 pl-2">
          {node.children.map((child) => (
            <TreeNode
              key={`${nodeKey}-${child.label}`}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              openKeys={openKeys}
              setOpenKeys={setOpenKeys}
              nodeKey={`${nodeKey}/${child.label}`}
              shortcutBadges={shortcutBadges}
              activeShortcutTarget={activeShortcutTarget}
              registerNodeRef={registerNodeRef}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openKeys, setOpenKeys] = useState({});
  const [shortcutScope, setShortcutScope] = useState(null);
  const [activeShortcutTarget, setActiveShortcutTarget] = useState("");
  const [mobileMenuSearch, setMobileMenuSearch] = useState("");
  const [showMobileSearchResults, setShowMobileSearchResults] = useState(false);
  const [mobileHeaderExpanded, setMobileHeaderExpanded] = useState(false);
  const { companyId, activeCompanyName } = useActiveCompany();
  const nodeRefs = useRef({});
  const searchInputRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const activeUser = useMemo(() => readStoredUser(), []);

  const treeWithIcons = useMemo(
    () =>
      filterNavigationByRole(menuTree, activeUser?.role).map((section) => ({
        ...section,
        icon: section.icon || ScrollText,
      })),
    [activeUser?.role],
  );

  const shortcutBadges = useMemo(() => {
    const badges = {};
    sidebarParentShortcuts.forEach((shortcut) => {
      const targetKey = shortcut.openKey || shortcut.scope || shortcut.route;
      if (targetKey) {
        badges[targetKey] = `Ctrl+${shortcut.key.toUpperCase()}`;
      }
    });
    Object.values(sidebarChildShortcuts).forEach((rows) => {
      rows.forEach((row) => {
        badges[row.route] = `Alt+${row.key.toUpperCase()}`;
      });
    });
    return badges;
  }, []);

  const mobileSearchEntries = useMemo(
    () =>
      flattenNavigationEntries(treeWithIcons)
        .filter((entry) => entry.to)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [treeWithIcons],
  );

  const mobileSearchResults = useMemo(() => {
    const query = mobileMenuSearch.trim().toLowerCase();
    if (!query) return mobileSearchEntries.slice(0, 12);
    return mobileSearchEntries
      .filter((entry) => {
        const breadcrumb = entry.trail.join(" ");
        return (
          entry.label.toLowerCase().includes(query) ||
          entry.to.toLowerCase().includes(query) ||
          breadcrumb.toLowerCase().includes(query)
        );
      })
      .slice(0, 12);
  }, [mobileMenuSearch, mobileSearchEntries]);

  function registerNodeRef(key, element) {
    if (!key) return;
    if (element) {
      nodeRefs.current[key] = element;
      return;
    }
    delete nodeRefs.current[key];
  }

  useEffect(() => {
    if (!shortcutScope) return undefined;
    const timeout = window.setTimeout(() => setShortcutScope(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [shortcutScope]);

  useEffect(() => {
    if (!activeShortcutTarget) return undefined;
    const target = nodeRefs.current[activeShortcutTarget];
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timeout = window.setTimeout(() => setActiveShortcutTarget(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [activeShortcutTarget]);

  useEffect(() => {
    onCloseMobile();
    setMobileMenuSearch("");
    setShowMobileSearchResults(false);
    setMobileHeaderExpanded(false);
  }, [location.pathname, onCloseMobile]);

  useEffect(() => {
    if (!mobileOpen) {
      setShowMobileSearchResults(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!mobileSearchRef.current?.contains(event.target)) {
        setShowMobileSearchResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleSidebarShortcuts(event) {
      if (event.ctrlKey && !event.altKey && !event.shiftKey) {
        const match = sidebarParentShortcuts.find(
          (entry) => entry.key.toLowerCase() === String(event.key).toLowerCase(),
        );
        if (!match) return;

        event.preventDefault();
        const targetKey = match.openKey || match.scope || match.route || "";
        if (match.openKey) {
          openTreePath(match.openKey, setOpenKeys);
        }
        if (match.scope) {
          setShortcutScope({
            key: match.scope,
            label: match.label,
          });
        } else {
          setShortcutScope(null);
        }
        setActiveShortcutTarget(targetKey);
        if (match.route) {
          navigate(match.route);
        }
        return;
      }

      if (!event.altKey || event.ctrlKey || event.shiftKey) return;
      if (!shortcutScope?.key) return;

      const childMatch = (sidebarChildShortcuts[shortcutScope.key] || []).find(
        (entry) => entry.key.toLowerCase() === String(event.key).toLowerCase(),
      );
      if (!childMatch) return;

      event.preventDefault();
      setActiveShortcutTarget(childMatch.route);
      navigate(childMatch.route);
      setShortcutScope(null);
    }

    window.addEventListener("keydown", handleSidebarShortcuts);
    return () => window.removeEventListener("keydown", handleSidebarShortcuts);
  }, [navigate, shortcutScope]);

  function handleLogout() {
    window.localStorage.removeItem("pos-user");
    window.localStorage.removeItem("attendance-user");
    window.localStorage.removeItem(EMPLOYEE_SESSION_TOKEN_KEY);
    onCloseMobile();
    navigate("/login", { replace: true });
  }

  function handleMobileSearchNavigate(route) {
    setActiveShortcutTarget(route);
    setShowMobileSearchResults(false);
    setMobileMenuSearch("");
    onCloseMobile();
    navigate(route);
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={onCloseMobile}
          aria-label="Close navigation overlay"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[18.5rem] max-w-[88vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:w-[23rem] lg:max-w-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
      <div className="border-b border-slate-200 px-4 py-4 lg:px-6 lg:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 lg:text-xl">AccuBooks</h1>
            <p className="text-xs text-slate-500">
              Tally-style Accounting System
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileHeaderExpanded((current) => !current)}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 lg:hidden"
            aria-label="Toggle mobile quick tools"
          >
            <ChevronsUpDown className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 lg:hidden"
            aria-label="Close navigation"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
        <div className={`${mobileHeaderExpanded ? "mt-4 block" : "mt-0 hidden"} lg:mt-4 lg:block`}>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Active Company
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            {activeCompanyName || companyId || "No company selected"}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
        <div className={`mt-4 ${mobileHeaderExpanded ? "block" : "hidden"} lg:hidden`}>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Menu Search
          </label>
          <div ref={mobileSearchRef} className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={mobileMenuSearch}
              onFocus={() => setShowMobileSearchResults(true)}
              onChange={(event) => {
                setMobileMenuSearch(event.target.value);
                setShowMobileSearchResults(true);
              }}
              placeholder="Search page, report, or voucher..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {showMobileSearchResults ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                {mobileSearchResults.length ? (
                  <div className="space-y-1">
                    {mobileSearchResults.map((entry) => (
                      <button
                        key={`${entry.to}-${entry.trail.join("/")}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleMobileSearchNavigate(entry.to)}
                        className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <p className="text-sm font-medium text-slate-900">{entry.label}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {entry.trail.join(" / ")}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                    No matching pages found.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 lg:px-4">
        <nav className="space-y-3">
          {treeWithIcons.map((section) => {
            const Icon = section.icon;
            const active = hasActiveNode(section, location.pathname);

            if (!section.children && section.to) {
              return (
                <Link
                  key={section.label}
                  to={section.to}
                  ref={(element) => registerNodeRef(section.to, element)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : activeShortcutTarget === section.to
                        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span className="flex-1">{section.label}</span>
                  {shortcutBadges[section.to] ? (
                    <ShortcutBadge tone={active || activeShortcutTarget === section.to ? "amber" : "slate"}>
                      {shortcutBadges[section.to]}
                    </ShortcutBadge>
                  ) : null}
                </Link>
              );
            }

            return (
              <section
                key={section.label}
                ref={(element) => registerNodeRef(section.label, element)}
                className={`rounded-2xl border px-3 py-3 ${
                  activeShortcutTarget === section.label
                    ? "border-amber-300 bg-amber-50/80 ring-1 ring-amber-200"
                    : "border-slate-200 bg-slate-50/70"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Icon className="h-4.5 w-4.5 text-slate-500" />
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {section.label}
                    </h2>
                    {shortcutBadges[section.label] ? (
                      <ShortcutBadge tone={activeShortcutTarget === section.label ? "amber" : "slate"}>
                        {shortcutBadges[section.label]}
                      </ShortcutBadge>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  {section.children.map((child) => (
                    <TreeNode
                      key={`${section.label}-${child.label}`}
                      node={child}
                      pathname={location.pathname}
                      openKeys={openKeys}
                      setOpenKeys={setOpenKeys}
                      nodeKey={`${section.label}/${child.label}`}
                      shortcutBadges={shortcutBadges}
                      activeShortcutTarget={activeShortcutTarget}
                      registerNodeRef={registerNodeRef}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
      </div>

      {/* <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-500 lg:px-5">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Accounting workspace
        </div>
        <p className="mt-1">
          `Ctrl + key` opens a sidebar tab. `Alt + key` jumps to a child page. `Ctrl + Shift + L` opens screen search.
        </p>
        {shortcutScope ? (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
            Active shortcut scope: <span className="font-semibold">{shortcutScope.label}</span>
          </div>
        ) : null}
      </div> */}
      </aside>
    </>
  );
}
