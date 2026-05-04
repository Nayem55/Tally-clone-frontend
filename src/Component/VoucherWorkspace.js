import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Printer, Save, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { voucherShortcuts } from "../utils/shortcuts";
import useVoucherShortcuts from "../hooks/useVoucherShortcuts";
import SaveVoucherModal from "./SaveVoucherModal";
import { previewVoucherNode, printVoucherNode } from "../utils/printVoucher";

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
    <section data-print-card="true" className="border border-[#b9c8da] bg-[#eef5ff] p-3 shadow-sm">
      <h3 className="text-[14px] font-semibold text-[#214b91]">{title}</h3>
      <div className="mt-3">{children}</div>
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
  onAddRow,
  summaryTag,
  summaryItems = [],
  amountSummaryItems = [],
  shortcuts = [],
  onPreviewPrint,
  onPrintAfterSave,
  extraActions = null,
  children,
}) {
  const Icon = icon;
  const containerRef = useRef(null);
  const location = useLocation();
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const mergedShortcuts = useMemo(() => {
    const incomingByLabel = new Map(shortcuts.map((item) => [item.label, item]));
    return voucherShortcuts.map((shortcut) => {
      const incoming = incomingByLabel.get(shortcut.label);
      return {
        ...shortcut,
        ...(incoming || {}),
        active: incoming?.active || location.pathname === shortcut.route,
      };
    });
  }, [shortcuts, location.pathname]);

  useVoucherShortcuts({
    shortcuts: mergedShortcuts,
    containerRef,
    onAddRow,
    onSaveRequest: () => setShowSaveConfirm(true),
  });

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      const target =
        containerRef.current?.querySelector("[data-voucher-date='true']") ||
        containerRef.current?.querySelector("[data-default-focus='true']");
      target?.focus();
      target?.select?.();
    });

    return () => window.cancelAnimationFrame(handle);
  }, []);

  async function handleSave(mode = "save") {
    setShowSaveConfirm(false);
    await onSave?.({
      printAfterSave: mode === "print",
      printVoucher:
        onPrintAfterSave || (() => printVoucherNode(containerRef.current, title)),
    });
  }

  function focusRelativeField(currentTarget, direction) {
    const fields = Array.from(
      containerRef.current?.querySelectorAll("[data-vnav='true']") || []
    ).filter((node) => !node.disabled && node.offsetParent !== null);
    const currentIndex = fields.indexOf(currentTarget);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < fields.length) {
      fields[nextIndex].focus();
      fields[nextIndex].select?.();
    }
  }

  function handleContainerKeyDown(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const tag = target.tagName.toLowerCase();
    if (tag === "textarea" && event.key === "Enter") return;
    if (!target.closest("[data-vnav='true']")) return;

    if (event.key === "Enter") {
      event.preventDefault();
      focusRelativeField(target, 1);
      return;
    }

    if (
      event.key === "Backspace" &&
      "value" in target &&
      String(target.value || "") === ""
    ) {
      event.preventDefault();
      focusRelativeField(target, -1);
    }
  }

  return (
    <div
      data-print-root="true"
      className="min-h-screen bg-[#f1f1f1] px-0 py-0"
      ref={containerRef}
      onKeyDown={handleContainerKeyDown}
    >
      <div className="mx-auto max-w-full">
        <section data-print-header="true" className="border-b border-[#a6bfdc] bg-[#f7fbff] px-3 py-2">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div data-print-hide="true" className={`flex h-10 w-10 items-center justify-center rounded-full ${iconTone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h1 data-print-title="true" className="text-[28px] font-semibold text-[#1f2f55]">{title}</h1>
                <p data-print-subtitle="true" className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
              </div>
            </div>

            <div data-print-hide="true" className="flex flex-wrap gap-3">
              {extraActions}
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700"
                onClick={() =>
                  (onPreviewPrint || (() => previewVoucherNode(containerRef.current, title)))()
                }
              >
                <Printer className="h-4 w-4" />
                Print Preview
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700"
                onClick={onCancel}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700"
                onClick={onSaveDraft}
              >
                <Save className="h-4 w-4" />
                Save Draft
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-[#1463ff] px-6 py-2.5 text-[14px] font-semibold text-white"
                onClick={() => setShowSaveConfirm(true)}
              >
                <Check className="h-4 w-4" />
                Save Voucher
                <ChevronDown className="h-4 w-4 opacity-70" />
              </button>
            </div>
          </div>
        </section>

        <div data-print-layout="true" className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_250px]">
          <div data-print-main="true" className="space-y-4 bg-[#f8f8f8] p-3">{children}</div>

          <aside data-print-sidebar="true" className="border-l border-[#b8cbe1] bg-[#dbeeff] p-3 space-y-3">
            <InfoCard title="Voucher Summary">
              <div className="space-y-2 text-[13px]">
                {summaryTag ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Type</span>
                    <span className="font-semibold text-[#214b91]">{summaryTag}</span>
                  </div>
                ) : null}
                {summaryItems.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="text-right font-medium text-slate-900">{item.value || "-"}</span>
                  </div>
                ))}
              </div>
            </InfoCard>

            <InfoCard title="Amount Summary">
              <div className="space-y-2 text-[13px]">
                {amountSummaryItems.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <span className={item.emphasis ? "font-semibold text-slate-800" : "text-slate-600"}>
                      {item.label}
                    </span>
                    <span className={`text-right font-semibold ${item.tone || "text-slate-900"}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </InfoCard>

            <div data-print-hide="true">
            <InfoCard title="Short Keys">
              <div className="space-y-2">
                {mergedShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className={`flex items-center justify-between border px-3 py-2 text-[13px] ${
                      shortcut.active
                        ? "border-[#8eb5ff] bg-white text-[#1957d2]"
                        : "border-[#c4d7ec] bg-[#f7fbff] text-slate-700"
                    }`}
                  >
                    <span className="font-semibold">{shortcut.primary}</span>
                    <span>{shortcut.label}</span>
                    <span className="text-[11px] text-slate-400">Alt+{shortcut.alternate}</span>
                  </div>
                ))}
              </div>
            </InfoCard>
            </div>
          </aside>
        </div>
      </div>

      <SaveVoucherModal
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onSave={() => handleSave("save")}
        onSaveAndPrint={() => handleSave("print")}
      />
    </div>
  );
}

export function VoucherPanel({ title, children, className = "" }) {
  return (
    <section data-print-panel="true" className={`border border-[#bccfe3] bg-white p-4 shadow-sm ${className}`}>
      <h2 data-print-panel-title="true" className="text-[16px] font-semibold text-[#1f2f55]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
