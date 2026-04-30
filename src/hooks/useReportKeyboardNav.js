import { useEffect } from "react";

export default function useReportKeyboardNav(containerRef, dependencies = [], options = {}) {
  const dependencyKey = JSON.stringify(dependencies || []);
  const hasOnExit = typeof options.onExit === "function";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const focusables = Array.from(
      container.querySelectorAll("[data-report-nav='true']")
    ).filter((node) => !node.hasAttribute("disabled"));

    if (
      focusables.length > 0 &&
      (!container.contains(document.activeElement) ||
        document.activeElement === document.body)
    ) {
      focusables[0].focus();
      focusables[0].scrollIntoView?.({ block: "nearest" });
    }

    function isTypingTarget(node) {
      if (!node) return false;
      const tag = String(node.tagName || "").toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        node.isContentEditable
      );
    }

    function handleKeyDown(event) {
      if (!["ArrowDown", "ArrowUp", "Enter", "Backspace", "Escape"].includes(event.key)) {
        return;
      }

      const current = document.activeElement;
      const currentInsideContainer = current && container.contains(current);

      if (event.key === "Escape") {
        if (!hasOnExit || isTypingTarget(current)) return;
        if (currentInsideContainer || document.activeElement === document.body) {
          event.preventDefault();
          options.onExit();
        }
        return;
      }

      if (!current || !container.contains(current) || current.dataset.reportNav !== "true") {
        return;
      }

      const nodes = Array.from(
        container.querySelectorAll("[data-report-nav='true']")
      ).filter((node) => !node.hasAttribute("disabled"));
      const index = nodes.indexOf(current);
      if (index < 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = nodes[Math.min(index + 1, nodes.length - 1)];
        next?.focus();
        next?.scrollIntoView?.({ block: "nearest" });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const previous = nodes[Math.max(index - 1, 0)];
        previous?.focus();
        previous?.scrollIntoView?.({ block: "nearest" });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        current.click?.();
        return;
      }

      if (event.key === "Backspace" && current.dataset.reportBack === "true") {
        event.preventDefault();
        current.click?.();
        return;
      }

      if (event.key === "Backspace" && hasOnExit && !isTypingTarget(current)) {
        event.preventDefault();
        options.onExit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, dependencyKey]);
}
