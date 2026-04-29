import { useEffect, useState } from "react";
import { formatDateForDisplay, parseFlexibleDateInput } from "../utils/voucherDates";

export default function TallyDateInput({
  value,
  onChange,
  className = "",
  placeholder = "dd-mm-yyyy",
  ...props
}) {
  const [draft, setDraft] = useState(formatDateForDisplay(value));

  useEffect(() => {
    setDraft(formatDateForDisplay(value));
  }, [value]);

  function commit(rawValue) {
    const parsed = parseFlexibleDateInput(rawValue);
    if (!parsed) {
      setDraft(formatDateForDisplay(value));
      return;
    }
    onChange(parsed);
    setDraft(formatDateForDisplay(parsed));
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      data-vnav="true"
      value={draft}
      placeholder={placeholder}
      className={className}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit(event.currentTarget.value);
        }
      }}
    />
  );
}
