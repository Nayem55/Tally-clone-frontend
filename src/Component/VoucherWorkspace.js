import { Check, ChevronDown, Save, X } from "lucide-react";

export function formatVoucherMoney(value, symbol = "") {
  const amount = Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol} ${amount}` : amount;
}

export function renderBalance(value, side, symbol = "") {
  if (value === undefined || value === null) return "-";
  return `${formatVoucherMoney(value, symbol)} ${side || ""}`.trim();
}

function InfoCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function VoucherWorkspace({
  title,
  subtitle,
  icon,
  iconTone = "bg-blue-50 text-blue-600",
  onCancel,
  onSave,
  onSaveDraft,
  summaryTag,
  summaryItems = [],
  amountSummaryItems = [],
  shortcuts = [],
  children,
}) {
  const Icon = icon;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconTone}`}>
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
                <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={onCancel}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={onSaveDraft}
              >
                <Save className="h-4 w-4" />
                Save Draft
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                onClick={onSave}
              >
                <Check className="h-4 w-4" />
                Save Voucher
                <ChevronDown className="h-4 w-4 opacity-70" />
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
          <div className="space-y-6">{children}</div>

          <aside className="space-y-6">
            <InfoCard title="Voucher Summary">
              <div className="space-y-4 text-sm">
                {summaryTag ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Type</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {summaryTag}
                    </span>
                  </div>
                ) : null}
                {summaryItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="text-right font-medium text-slate-900">{item.value || "-"}</span>
                  </div>
                ))}
              </div>
            </InfoCard>

            <InfoCard title="Amount Summary">
              <div className="space-y-4 text-sm">
                {amountSummaryItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className={item.emphasis ? "font-semibold text-slate-800" : "text-slate-500"}>
                      {item.label}
                    </span>
                    <span className={`text-right font-semibold ${item.tone || "text-slate-900"}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </InfoCard>

            <InfoCard title="Shortcuts">
              <div className="space-y-3">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm ${
                      shortcut.active
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <span className="font-semibold">{shortcut.key}</span>
                    <span>{shortcut.label}</span>
                  </div>
                ))}
              </div>
            </InfoCard>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function VoucherPanel({ title, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 ${className}`}>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
