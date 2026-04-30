import { useEffect, useRef } from "react";
import { Check, Printer } from "lucide-react";

export default function SaveVoucherModal({
  open,
  onClose,
  onSave,
  onSaveAndPrint,
  title = "Save voucher?",
  description = "We are ready to post this voucher. Once saved, it will update the connected stock and accounting reports.",
}) {
  const saveButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const focusTimer = window.setTimeout(() => {
      saveButtonRef.current?.focus();
    }, 10);

    function handleConfirmKeys(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleConfirmKeys);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleConfirmKeys);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Check className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            onClick={onSaveAndPrint}
          >
            <Printer className="h-4 w-4" />
            Save & Print
          </button>
          <button
            type="button"
            ref={saveButtonRef}
            className="rounded-xl bg-[#1463ff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f57eb]"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
