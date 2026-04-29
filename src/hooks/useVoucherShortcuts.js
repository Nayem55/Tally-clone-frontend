import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function useVoucherShortcuts({
  shortcuts,
  containerRef,
  onAddRow,
  onSaveRequest,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyboard(event) {
      const match = shortcuts.find(
        (shortcut) =>
          shortcut.primary === event.key ||
          (event.altKey &&
            shortcut.alternate &&
            shortcut.alternate.toLowerCase() === String(event.key).toLowerCase()),
      );

      if (!match) return;

      if (match.focusTarget) {
        event.preventDefault();
        const target = containerRef?.current?.querySelector(match.focusTarget);
        target?.focus();
        target?.select?.();
        return;
      }

      if (match.action === "addRow" && onAddRow) {
        event.preventDefault();
        onAddRow();
        return;
      }

      if (match.action === "saveVoucher" && onSaveRequest) {
        event.preventDefault();
        onSaveRequest();
        return;
      }

      if (match.route) {
        event.preventDefault();
        navigate(match.route);
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [containerRef, navigate, onAddRow, onSaveRequest, shortcuts]);
}
