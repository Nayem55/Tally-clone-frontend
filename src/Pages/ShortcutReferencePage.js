import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Keyboard, Monitor, PanelLeftOpen } from "lucide-react";
import { sidebarChildShortcuts, sidebarParentShortcuts, voucherShortcuts } from "../utils/shortcuts";

function ShortcutCard({ title, icon: Icon, subtitle, children }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function KeyPill({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-300 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`inline-flex min-w-[84px] justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ParentShortcutRow({ shortcut, childrenRows, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={childrenRows.length ? onToggle : undefined}
        className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-left ${
          childrenRows.length ? "hover:bg-slate-100" : ""
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          {childrenRows.length ? (
            isOpen ? (
              <ChevronDown className="mt-0.5 h-4 w-4 flex-none text-slate-500" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 flex-none text-slate-500" />
            )
          ) : (
            <span className="block w-4 flex-none" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{shortcut.label}</div>
            <div className="mt-1 text-xs text-slate-500">
              {shortcut.scope ? `Opens scope: ${shortcut.scope}` : `Route: ${shortcut.route}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {childrenRows.length ? (
            <span className="hidden text-xs font-medium text-slate-400 md:inline">
              {childrenRows.length} child shortcuts
            </span>
          ) : null}
          <KeyPill tone="blue">{`Ctrl + ${shortcut.key.toUpperCase()}`}</KeyPill>
        </div>
      </button>

      {childrenRows.length && isOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4">
          <div className="grid gap-2 md:grid-cols-2">
            {childrenRows.map((row) => (
              <div
                key={`${shortcut.label}-${row.key}-${row.label}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{row.label}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">{row.route}</div>
                </div>
                <KeyPill>{`Alt + ${row.key.toUpperCase()}`}</KeyPill>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ShortcutReferencePage() {
  const [openScopes, setOpenScopes] = useState(() =>
    Object.fromEntries(
      sidebarParentShortcuts.map((shortcut) => [shortcut.scope || shortcut.label, false]),
    ),
  );

  const parentRows = useMemo(
    () =>
      sidebarParentShortcuts.map((shortcut) => ({
        ...shortcut,
        childrenRows: shortcut.scope ? sidebarChildShortcuts[shortcut.scope] || [] : [],
      })),
    [],
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <Keyboard className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">All Short Keys</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Use this page as the keyboard map for the whole accounting workspace. Sidebar navigation uses
                `Ctrl + key` to choose a parent area and `Alt + key` to jump into a child page. Voucher screens
                keep the fast function-key flow for data entry.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <ShortcutCard
            title="Sidebar Navigation"
            icon={PanelLeftOpen}
            subtitle="Press a parent shortcut first. Expand any parent card below to see the matching child shortcuts."
          >
            <div className="space-y-3">
              {parentRows.map((shortcut) => {
                const scopeKey = shortcut.scope || shortcut.label;
                return (
                  <ParentShortcutRow
                    key={`${shortcut.key}-${shortcut.label}`}
                    shortcut={shortcut}
                    childrenRows={shortcut.childrenRows}
                    isOpen={Boolean(openScopes[scopeKey])}
                    onToggle={() =>
                      setOpenScopes((current) => ({
                        ...current,
                        [scopeKey]: !current[scopeKey],
                      }))
                    }
                  />
                );
              })}
            </div>
          </ShortcutCard>

          <ShortcutCard
            title="Voucher Entry Shortcuts"
            icon={Monitor}
            subtitle="These work inside voucher screens. Function keys are primary and Alt keys are the browser-friendly fallback."
          >
            <div className="space-y-3">
              {voucherShortcuts.map((shortcut) => (
                <div
                  key={shortcut.label}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{shortcut.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {shortcut.route
                        ? `Jump to ${shortcut.label}`
                        : shortcut.action === "addRow"
                          ? "Insert a new voucher row"
                          : shortcut.action === "saveVoucher"
                            ? "Save the current voucher with confirmation"
                            : "Focus the date field"}
                    </div>
                  </div>
                  <KeyPill tone="emerald">{shortcut.primary}</KeyPill>
                  <KeyPill>{`Alt + ${shortcut.alternate}`}</KeyPill>
                </div>
              ))}
            </div>
          </ShortcutCard>
        </div>
      </div>
    </div>
  );
}
