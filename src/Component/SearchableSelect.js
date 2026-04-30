import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  optionClassName = "",
  dataNav = true,
  allowClear = false,
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [selectedOption]);

  useEffect(() => {
    function handleOutside(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery(selectedOption?.label || "");
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.meta || ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, query]);

  function selectOption(option) {
    onChange(option?.value || "");
    setQuery(option?.label || "");
    setOpen(false);
    setHighlightedIndex(0);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          data-vnav={dataNav ? "true" : undefined}
          className="w-full border border-[#c8d2de] bg-[#EEF5FF] py-1.5 pl-9 pr-8 text-[14px] text-slate-900 outline-none focus:border-[#3f83f8]"
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            if (selectedOption && event.target.value !== selectedOption.label && allowClear) {
              onChange("");
            }
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlightedIndex((current) =>
                Math.min(current + 1, Math.max(filteredOptions.length - 1, 0))
              );
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((current) => Math.max(current - 1, 0));
              return;
            }
            if (event.key === "Enter" && open) {
              if (filteredOptions[highlightedIndex]) {
                event.preventDefault();
                event.stopPropagation();
                selectOption(filteredOptions[highlightedIndex]);
              }
              return;
            }
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(selectedOption?.label || "");
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
          onClick={() => {
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto border border-[#bfcad8] bg-white shadow-xl">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <button
                key={option.value}
                type="button"
                className={`flex w-full items-start justify-between gap-4 px-3 py-2 text-left text-[14px] ${
                  index === highlightedIndex ? "bg-[#d9ebff]" : "hover:bg-slate-50"
                } ${optionClassName}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
              >
                <span>{option.label}</span>
                {option.meta ? <span className="text-[12px] text-slate-400">{option.meta}</span> : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-[13px] text-slate-500">No matches found.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
