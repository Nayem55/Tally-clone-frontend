import { useEffect, useMemo, useState } from "react";
import { BadgeMinus, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";

const emptyRow = { itemId: "", qty: "1", rate: "" };

export default function DebitNoteVoucher({ companyId }) {
  const [debitTypeId, setDebitTypeId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    supplierLedger: "",
    returnLedger: "",
    narration: "",
    rows: [emptyRow],
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      const [voucherResponse, supplierResponse, ledgerResponse, itemResponse, companyResponse] =
        await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Creditors`),
          api.get(`/companies/${companyId}/ledgers/with-balances`, { params: { to: form.date } }),
          api.get(`/companies/${companyId}/items`),
          api.get("/companies"),
        ]);
      setDebitTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "debit note")?._id || ""
      );
      setSuppliers(supplierResponse.data);
      setLedgers(ledgerResponse.data);
      setItems(itemResponse.data);
      setCompanies(companyResponse.data);
    }
    loadMasters();
  }, [companyId, form.date]);

  const company = companies.find((entry) => entry._id === companyId);
  const currency = getCompanyCurrency(company);
  const itemMap = useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
  const ledgerMap = useMemo(() => new Map(ledgers.map((ledger) => [ledger._id, ledger])), [ledgers]);
  const supplierLedger = ledgerMap.get(form.supplierLedger);
  const returnLedger = ledgerMap.get(form.returnLedger);
  const supplierOptions = useMemo(
    () => suppliers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [suppliers]
  );
  const ledgerOptions = useMemo(
    () => ledgers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [ledgers]
  );
  const itemOptions = useMemo(
    () => items.map((item) => ({ value: item._id, label: item.name })),
    [items]
  );

  const lineAmount = (row) => Number((Number(row.qty || 0) * Number(row.rate || 0)).toFixed(2));
  const validRows = form.rows.filter((row) => row.itemId && Number(row.qty) > 0);
  const totalAmount = validRows.reduce((sum, row) => sum + lineAmount(row), 0);

  function updateRow(index, key, value) {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      if (key === "itemId") {
        rows[index].rate = resolveItemRateByDate(itemMap.get(value), null, prev.date);
      }
      return { ...prev, rows };
    });
  }

  function addRow() {
    setForm((prev) => ({ ...prev, rows: [...prev.rows, emptyRow] }));
  }

  function removeRow(index) {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateDate(value) {
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) =>
        row.itemId ? { ...row, rate: resolveItemRateByDate(itemMap.get(row.itemId), null, value) } : row
      ),
    }));
  }

  function resetForm() {
    setForm({
      number: "",
      date: formatDateForInput(new Date()),
      supplierLedger: "",
      returnLedger: "",
      narration: "",
      rows: [emptyRow],
    });
  }

  async function save() {
    if (!debitTypeId) return alert("Debit note type missing");
    if (!form.supplierLedger) return alert("Please select supplier");
    if (!form.returnLedger) return alert("Please select return ledger");
    if (validRows.length === 0) return alert("Please add at least one item");

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: debitTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration || "Debit Note",
      lines: [
        { ledgerId: form.returnLedger, debit: totalAmount, credit: 0 },
        { ledgerId: form.supplierLedger, debit: 0, credit: totalAmount },
      ],
      inventoryLines: validRows.map((row) => ({
        itemId: row.itemId,
        qty: Number(row.qty),
        rate: Number(row.rate),
        amount: lineAmount(row),
      })),
    });
    alert("Debit note saved");
    resetForm();
  }

  return (
    <VoucherWorkspace
      title="Debit Note"
      subtitle="Purchase return entry with searchable ledgers, item suggestions, and typed dates."
      icon={BadgeMinus}
      iconTone="bg-amber-50 text-amber-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Debit Note"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Supplier", value: supplierLedger?.name || "-" },
        { label: "Return Ledger", value: returnLedger?.name || "-" },
      ]}
      amountSummaryItems={[
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
          tone: "text-emerald-600",
          emphasis: true,
        },
      ]}
      shortcuts={[
        { key: "F7", label: "Journal" },
        { key: "F8", label: "Sales" },
        { key: "F9", label: "Purchase" },
        { key: "F10", label: "Other Vouchers", active: true },
      ]}
    >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
            <TallyDateInput
              data-voucher-date="true"
              className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.date}
              onChange={updateDate}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Supplier</label>
            <SearchableSelect
              options={supplierOptions}
              value={form.supplierLedger}
              onChange={(newValue) => setForm((prev) => ({ ...prev, supplierLedger: newValue }))}
              placeholder="Search supplier"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {supplierLedger
                ? renderBalance(
                    supplierLedger.currentBalanceAbs,
                    supplierLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Return Ledger</label>
            <SearchableSelect
              options={ledgerOptions}
              value={form.returnLedger}
              onChange={(newValue) => setForm((prev) => ({ ...prev, returnLedger: newValue }))}
              placeholder="Search return ledger"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {returnLedger
                ? renderBalance(
                    returnLedger.currentBalanceAbs,
                    returnLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Item Details">
        <div className="overflow-hidden border border-[#bccfe3]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Item Name</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-4">
                    <SearchableSelect
                      options={itemOptions}
                      value={row.itemId}
                      onChange={(newValue) => updateRow(index, "itemId", newValue)}
                      placeholder="Search item"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      data-vnav="true"
                      type="number"
                      className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.qty}
                      onChange={(event) => updateRow(index, "qty", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      data-vnav="true"
                      type="number"
                      className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.rate}
                      onChange={(event) => updateRow(index, "rate", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {formatVoucherMoney(lineAmount(row), currency.symbol)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {form.rows.length > 1 ? (
                      <button
                        type="button"
                        className="rounded p-2 text-rose-500 hover:bg-rose-50"
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Add New Item
        </button>
      </VoucherPanel>

      <VoucherPanel title="Narration">
        <textarea
          data-vnav="true"
          className="min-h-24 w-full border border-[#c8d2de] bg-[#fffdf4] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Purchase return against supplier invoice."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
