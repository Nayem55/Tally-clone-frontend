import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { normalizeVoucherName } from "../utils/voucherRoutes";
import { navigateBackFromReport } from "../utils/reportNavigation";
import VoucherList from "./VoucherList";
import PosVoucherPage from "./PosVoucherPage";
import InventoryVoucherPage from "./InventoryVoucherPage";
import ManufacturingVoucherPage from "./ManufacturingVoucherPage";

export default function AlterVoucherEntryPage() {
  const { voucherId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { companyId: activeCompanyId, setCompanyId } = useActiveCompany();
  const [voucher, setVoucher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const routeCompanyId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("companyId") || activeCompanyId || "";
  }, [location.search, activeCompanyId]);

  useEffect(() => {
    if (routeCompanyId && routeCompanyId !== activeCompanyId) {
      setCompanyId(routeCompanyId);
    }
  }, [routeCompanyId, activeCompanyId, setCompanyId]);

  useEffect(() => {
    let alive = true;

    async function loadVoucher() {
      if (!routeCompanyId || !voucherId) return;
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/companies/${routeCompanyId}/vouchers/${voucherId}`);
        if (!alive) return;
        setVoucher(response.data);
      } catch (loadError) {
        if (!alive) return;
        setError(loadError?.response?.data?.message || "Unable to load voucher");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadVoucher();
    return () => {
      alive = false;
    };
  }, [routeCompanyId, voucherId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" || event.key === "Backspace") {
        const target = event.target;
        const tagName = String(target?.tagName || "").toLowerCase();
        const isTypingTarget =
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select" ||
          target?.isContentEditable;
        if (isTypingTarget && event.key === "Backspace") return;
        event.preventDefault();
        navigateBackFromReport(navigate, location);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [location, navigate]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading voucher for alteration...</div>;
  }

  if (error || !voucher) {
    return <div className="p-8 text-center text-sm text-rose-600">{error || "Voucher not found"}</div>;
  }

  const voucherName = normalizeVoucherName(voucher.voucherName);
  if (voucherName === "pos voucher") {
    return <PosVoucherPage editVoucherId={voucherId} companyIdOverride={routeCompanyId} />;
  }

  if (["receipt note", "delivery note", "stock journal"].includes(voucherName)) {
    return (
      <InventoryVoucherPage
        voucherName={voucher.voucherName}
        editVoucherId={voucherId}
        companyIdOverride={routeCompanyId}
      />
    );
  }

  if (voucherName === "manufacturing") {
    return <ManufacturingVoucherPage editVoucherId={voucherId} companyIdOverride={routeCompanyId} />;
  }

  return (
    <VoucherList
      initialVoucherName={voucher.voucherName}
      companyIdOverride={routeCompanyId}
      editVoucherId={voucherId}
    />
  );
}
