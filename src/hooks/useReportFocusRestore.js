import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function escapeAttributeValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export default function useReportFocusRestore(containerRef, dependencies = []) {
  const location = useLocation();
  const navigate = useNavigate();
  const dependencyKey = JSON.stringify(dependencies || []);

  useEffect(() => {
    const restoreFocusKey = location.state?.restoreFocusKey;
    const container = containerRef.current;

    if (!restoreFocusKey || !container) return;

    const selector = `[data-focus-key="${escapeAttributeValue(restoreFocusKey)}"]`;
    const target = container.querySelector(selector);

    if (target) {
      target.focus?.();
      target.scrollIntoView?.({ block: "nearest" });
    }

    const nextState = { ...(location.state || {}) };
    delete nextState.restoreFocusKey;
    navigate(`${location.pathname}${location.search || ""}`, {
      replace: true,
      state: nextState,
    });
  }, [containerRef, dependencyKey, location.pathname, location.search, location.state, navigate]);
}
