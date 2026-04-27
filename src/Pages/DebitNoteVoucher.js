import { useEffect, useMemo, useState } from "react";
import { BadgeMinus, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";

const emptyRow = {
  itemId: "",
  qty: "1",
  rate: "",
};

export default function DebitNoteVoucher({ companyId }) {
  const [debitTypeId, setDebitTypeId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
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

  const lineAmount = (row) => Number((Number(row.qty || 0) * Number(row.rate || 0)).toFixed(2));

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      if (key === "itemId") {
        rows[index].rate = resolveItemRateByDate(itemMap.get(value), null, prev.date);
      }
      return { ...prev, rows };
    });
  };

  const addRow = () => setForm((prev) => ({ ...prev, rows: [...prev.rows, emptyRow] }));
  const removeRow = (index) =>
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  const updateDate = (value) =>
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) =>
        row.itemId ? { ...row, rate: resolveItemRateByDate(itemMap.get(row.itemId), null, value) } : row
      ),
    }));

  const validRows = form.rows.filter((row) => row.itemId && Number(row.qty) > 0);
  const totalAmount = validRows.reduce((sum, row) => sum + lineAmount(row), 0);

  const resetForm = () =>
    setForm({
      number: "",
      date: new Date().toISOString().slice(0, 10),
      supplierLedger: "",
      returnLedger: "",
      narration: "",
      rows: [emptyRow],
    });

  const save = async () => {
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
  };

  return (
    <VoucherWorkspace
      title="Debit Note"
      subtitle="Record purchase returns and supplier adjustments with item-wise values."
      icon={BadgeMinus}
      iconTone="bg-amber-50 text-amber-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Debit Note"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Company", value: company?.name },
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
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.date}
              onChange={(event) => updateDate(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Supplier</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.supplierLedger}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, supplierLedger: event.target.value }))
              }
            >
              <option value="">Select supplier</option>
              {suppliers.map((ledger) => (
                <option key={ledger._id} value={ledger._id}>
                  {ledger.name}
                </option>
              ))}
            </select>
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
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.returnLedger}
              onChange={(event) => setForm((prev) => ({ ...prev, returnLedger: event.target.value }))}
            >
              <option value="">Select return ledger</option>
              {ledgers.map((ledger) => (
                <option key={ledger._id} value={ledger._id}>
                  {ledger.name}
                </option>
              ))}
            </select>
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
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
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
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-3"
                      value={row.itemId}
                      onChange={(event) => updateRow(index, "itemId", event.target.value)}
                    >
                      <option value="">Select item</option>
                      {items.map((entry) => (
                        <option key={entry._id} value={entry._id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-3"
                      value={row.qty}
                      onChange={(event) => updateRow(index, "qty", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-3"
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
                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
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
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Add New Item
        </button>
      </VoucherPanel>

      <VoucherPanel title="Narration">
        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Purchase return against supplier invoice."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
