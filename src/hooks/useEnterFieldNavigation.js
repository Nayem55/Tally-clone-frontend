import { useEffect } from "react";

function isTypingTarget(element) {
  if (!element) return false;
  const tag = String(element.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable;
}

export default function useEnterFieldNavigation(containerRef, deps = []) {
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return undefined;

    function focusRelative(current, step) {
      const fields = Array.from(
        container.querySelectorAll("[data-enter-nav='true']:not([disabled])"),
      ).filter((node) => node.offsetParent !== null);
      const index = fields.indexOf(current);
      if (index === -1) return;
      const next = fields[index + step];
      next?.focus();
      if (typeof next?.select === "function") {
        next.select();
      }
    }

    function handleKeyDown(event) {
      const target = event.target;
      if (!container.contains(target) || !isTypingTarget(target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === "Enter") {
        const tag = String(target.tagName || "").toLowerCase();
        if (tag === "textarea" || target.dataset.enterSubmit === "true") return;
        event.preventDefault();
        focusRelative(target, 1);
      }

      if (
        event.key === "Backspace" &&
        String(target.value || "").trim() === "" &&
        String(target.tagName || "").toLowerCase() !== "textarea"
      ) {
        event.preventDefault();
        focusRelative(target, -1);
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, ...deps]);
}
