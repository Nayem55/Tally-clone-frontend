import { useEffect, useState } from "react";
import api from "../api/api";
import ContraVoucher from "./ContraVoucher";
import PaymentVoucher from "./PaymentVoucher";
import ReceiptVoucher from "./ReceiptVoucher";
import JournalVoucher from "./JournalVoucher";
import SalesVoucher from "./SalesVoucher";
import PurchaseVoucher from "./PurchaseVoucher";
import DebitNoteVoucher from "./DebitNoteVoucher";
import CreditNoteVoucher from "./CreditNoteVoucher";


export default function VoucherList({ initialVoucherName = "" }) {
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const [voucherTypes, setVoucherTypes] = useState([]);
  const [selectedVoucherType, setSelectedVoucherType] = useState("");

  // ---------------- LOAD COMPANIES ----------------
  useEffect(() => {
    async function loadCompanies() {
      const res = await api.get("/companies");
      setCompanies(res.data);
    }
    loadCompanies();
  }, []);

  // ---------------- LOAD VOUCHER TYPES ----------------
  const loadVoucherTypes = async () => {
    if (!companyId) return;
    const res = await api.get(`/companies/${companyId}/voucher-types`);
    setVoucherTypes(res.data);
  };

  useEffect(() => {
    loadVoucherTypes();
  }, [companyId]);

  useEffect(() => {
    if (!initialVoucherName || voucherTypes.length === 0) return;
    const match = voucherTypes.find(
      (voucherType) =>
        voucherType.name.toLowerCase() === initialVoucherName.toLowerCase()
    );
    if (match) {
      setSelectedVoucherType(match._id);
    }
  }, [initialVoucherName, voucherTypes]);

  // ---------------- MATCHING COMPONENT BY NAME ----------------
  const renderVoucherComponent = () => {
    const vt = voucherTypes.find(v => v._id === selectedVoucherType);
    if (!vt) return null;

    const name = vt.name.toLowerCase();

    if (name === "contra")
      return <ContraVoucher companyId={companyId} />;

    if (name === "payment")
      return <PaymentVoucher companyId={companyId} />; // replace when ready

    if (name === "receipt")
      return <ReceiptVoucher companyId={companyId} />;

    if (name === "sales")
      return <SalesVoucher companyId={companyId} />;

    if (name === "journal")
      return <JournalVoucher companyId={companyId} />;

    if (name === "purchase")
      return <PurchaseVoucher companyId={companyId} />;

    if (name === "debit note")
      return <DebitNoteVoucher companyId={companyId} />;

    if (name === "credit note")
      return <CreditNoteVoucher companyId={companyId} />;

    return <div>Voucher Screen Not Implemented</div>;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-6 font-semibold">Accounting Vouchers</h1>

      {/* ---------- COMPANY PICKER ---------- */}
      <div className="mb-6 relative">
        <label className="block mb-1 font-medium">Select Company</label>

        <input
          type="text"
          className="border p-2 w-72"
          placeholder="Search company..."
          value={searchTerm}
          onFocus={() => setDropdownVisible(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setDropdownVisible(true);
          }}
        />

        {dropdownVisible && (
          <div className="absolute mt-1 w-72 bg-white border shadow rounded max-h-60 overflow-y-auto z-20">
            {companies
              .filter((c) =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((c) => (
                <div
                  key={c._id}
                  className="p-2 cursor-pointer hover:bg-blue-100"
                  onClick={() => {
                    setCompanyId(c._id);
                    setSearchTerm(c.name);
                    setDropdownVisible(false);
                  }}
                >
                  {c.name}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ---------- VOUCHER TYPE DROPDOWN ---------- */}
      {companyId && (
        <div className="bg-white shadow p-4 rounded w-80 mb-6">
          <label className="block mb-2 font-medium">Select Voucher</label>

          <select
            className="border p-2 w-full"
            value={selectedVoucherType}
            onChange={(e) => setSelectedVoucherType(e.target.value)}
          >
            <option value="">-- Select Voucher Type --</option>

            {voucherTypes.map((vt) => (
              <option key={vt._id} value={vt._id}>
                {vt.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ---------- SHOW VOUCHER SCREEN ---------- */}
      {selectedVoucherType && (
        <div className="mt-6">
          {renderVoucherComponent()}
        </div>
      )}
    </div>
  );
}
