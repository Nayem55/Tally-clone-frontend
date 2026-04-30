import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft, Layers3, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { flattenNavigation } from "../utils/navigationTree";

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

export default function CommandSearchModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedParent, setSelectedParent] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const allEntries = useMemo(() => flattenNavigation(), []);

  const parentOptions = useMemo(
    () => allEntries.filter((entry) => entry.hasChildren && entry.ancestors.length <= 1),
    [allEntries],
  );

  const directEntries = useMemo(
    () => allEntries.filter((entry) => entry.to),
    [allEntries],
  );

  const scopedResults = useMemo(() => {
    const source = selectedParent
      ? directEntries.filter(
          (entry) =>
            entry.ancestors.includes(selectedParent.label) &&
            entry.breadcrumbs !== selectedParent.breadcrumbs,
        )
      : [
          ...parentOptions.map((entry) => ({ ...entry, resultType: "parent" })),
          ...directEntries.map((entry) => ({ ...entry, resultType: "screen" })),
        ];

    const term = normalize(query);
    if (!term) {
      return source.slice(0, 14);
    }

    return source
      .filter((entry) => {
        const haystack = normalize(
          `${entry.label} ${entry.breadcrumbs} ${entry.parentLabel}`,
        );
        return haystack.includes(term);
      })
      .slice(0, 18);
  }, [directEntries, parentOptions, query, selectedParent]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, selectedParent, open]);

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.ctrlKey && event.shiftKey && normalize(event.key) === "l") {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedParent) {
          setSelectedParent(null);
          setQuery("");
          return;
        }
        setOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) =>
          Math.min(current + 1, Math.max(scopedResults.length - 1, 0)),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        if (!scopedResults[activeIndex]) return;
        event.preventDefault();
        const result = scopedResults[activeIndex];
        if (result.resultType === "parent" || result.hasChildren) {
          setSelectedParent(result);
          setQuery("");
          return;
        }
        navigate(result.to);
        setOpen(false);
        return;
      }

      if (event.key === "Backspace" && !query && selectedParent && isTypingTarget) {
        setSelectedParent(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, navigate, open, query, scopedResults, selectedParent]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open, selectedParent]);

  useEffect(() => {
    if (!open) return;
    const container = listRef.current;
    if (!container) return;
    const activeRow = container.querySelector("[data-command-active='true']");
    activeRow?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeIndex, open, query, scopedResults, selectedParent]);

  useEffect(() => {
    setOpen(false);
    setSelectedParent(null);
    setQuery("");
  }, [location.pathname]);

  if (!open) return null;

  const title = selectedParent
    ? `${selectedParent.label} screens`
    : "Jump to any screen";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/35 px-4 pt-24 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <Search className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="font-medium text-slate-900">{title}</span>
                {selectedParent ? (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    <span>{selectedParent.breadcrumbs}</span>
                  </>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Use <span className="font-semibold text-slate-700">Ctrl + Shift + L</span> from any screen. Type to search, press Enter to jump.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner">
            <Search className="h-4.5 w-4.5 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                selectedParent
                  ? `Search inside ${selectedParent.label}`
                  : "Search dashboard, vouchers, reports, masters..."
              }
              className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            {selectedParent ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedParent(null);
                  setQuery("");
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
            ) : null}
          </div>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto px-3 py-3">
          {scopedResults.length ? (
            <div className="space-y-1">
              {scopedResults.map((result, index) => {
                const isActive = index === activeIndex;
                const isCurrent = result.to && location.pathname === result.to;
                const isParentResult = result.resultType === "parent";
                return (
                  <button
                    key={`${result.breadcrumbs}-${result.to || result.label}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (isParentResult || result.hasChildren) {
                        setSelectedParent(result);
                        setQuery("");
                        return;
                      }
                      navigate(result.to);
                      setOpen(false);
                    }}
                    data-command-active={isActive ? "true" : "false"}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : isCurrent
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isParentResult ? (
                          <Layers3 className="h-4.5 w-4.5 flex-none" />
                        ) : null}
                        <span className="truncate text-sm font-semibold">{result.label}</span>
                      </div>
                      <div
                        className={`mt-1 truncate text-xs ${
                          isActive ? "text-blue-100" : "text-slate-500"
                        }`}
                      >
                        {result.breadcrumbs}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isParentResult ? (
                        <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                          isActive
                            ? "border-blue-300/60 bg-blue-500/30 text-blue-50"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}>
                          Open
                        </span>
                      ) : null}
                      <CornerDownLeft className={`h-4 w-4 ${isActive ? "text-blue-100" : "text-slate-400"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">No matching screens</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different name, or clear the current parent scope.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
