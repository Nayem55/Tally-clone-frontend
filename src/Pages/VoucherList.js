import ContraVoucher from "./ContraVoucher";
import PaymentVoucher from "./PaymentVoucher";
import ReceiptVoucher from "./ReceiptVoucher";
import JournalVoucher from "./JournalVoucher";
import SalesVoucher from "./SalesVoucher";
import PurchaseVoucher from "./PurchaseVoucher";
import DebitNoteVoucher from "./DebitNoteVoucher";
import CreditNoteVoucher from "./CreditNoteVoucher";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";

export default function VoucherList({
  initialVoucherName = "",
  companyIdOverride = "",
  editVoucherId = "",
}) {
  const { companyId: activeCompanyId } = useActiveCompany();
  const companyId = companyIdOverride || activeCompanyId;

  function renderVoucherComponent() {
    const name = initialVoucherName.toLowerCase();
    if (name === "contra") return <ContraVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    if (name === "payment") return <PaymentVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    if (name === "receipt") return <ReceiptVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    if (name === "sales") return <SalesVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    if (name === "journal") return <JournalVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    if (name === "purchase") return <PurchaseVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    if (name === "debit note") return <DebitNoteVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    if (name === "credit note") return <CreditNoteVoucher companyId={companyId} editVoucherId={editVoucherId} />;
    return <div className="p-6 text-sm text-slate-500">Voucher Screen Not Implemented</div>;
  }

  if (!companyId) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading voucher...</div>;
  }

  return renderVoucherComponent();
}
