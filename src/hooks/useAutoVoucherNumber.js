import { useCallback, useEffect, useState } from "react";
import api from "../api/api";

function slugifySegment(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function useAutoVoucherNumber({
  companyId,
  voucherTypeId,
  companyName = "",
  voucherLabel = "",
  disabled = false,
}) {
  const [suggestedNumber, setSuggestedNumber] = useState("");

  const buildFallbackNumber = useCallback(
    (vouchers = []) => {
      const companySlug = slugifySegment(companyName) || "company";
      const voucherSlug = slugifySegment(voucherLabel) || "voucher";
      const prefix = `${companySlug}-${voucherSlug}-`;

      let maxSequence = 0;
      vouchers.forEach((voucher) => {
        const numberText = String(voucher.number || "").trim();
        const match = numberText.match(new RegExp(`^${prefix}(\\d+)$`, "i"));
        if (match) {
          maxSequence = Math.max(maxSequence, Number(match[1] || 0));
        }
      });

      return `${prefix}${String(maxSequence + 1).padStart(2, "0")}`;
    },
    [companyName, voucherLabel]
  );

  const refreshSuggestedNumber = useCallback(async () => {
    if (!companyId || !voucherTypeId || disabled) {
      setSuggestedNumber("");
      return "";
    }

    try {
      const response = await api.get(`/companies/${companyId}/vouchers/next-number`, {
        params: { voucherTypeId },
      });
      const nextValue =
        response.data?.formattedNumber ||
        String(response.data?.nextNumber || "");
      if (nextValue) {
        setSuggestedNumber(nextValue);
        return nextValue;
      }
      throw new Error("Missing next voucher number");
    } catch (error) {
      const voucherResponse = await api.get(`/companies/${companyId}/vouchers`, {
        params: { type: voucherTypeId },
      });
      const vouchers = voucherResponse.data || [];
      const fallbackNumber = buildFallbackNumber(vouchers);
      setSuggestedNumber(fallbackNumber);
      return fallbackNumber;
    }
  }, [buildFallbackNumber, companyId, disabled, voucherTypeId]);

  useEffect(() => {
    refreshSuggestedNumber().catch(() => {
      setSuggestedNumber((current) => current || buildFallbackNumber([]));
    });
  }, [buildFallbackNumber, refreshSuggestedNumber]);

  return {
    suggestedNumber,
    refreshSuggestedNumber,
  };
}
