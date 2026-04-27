import { useEffect, useMemo, useState } from "react";
import { ReceiptText, Plus, Trash2 } from "lucide-react";
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

export default function CreditNoteVoucher({ companyId }) {
  const [creditTypeId, setCreditTypeId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    customerLedger: "",
    returnLedger: "",
    narration: "",
    rows: [emptyRow],
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      const [voucherResponse, customerResponse, ledgerResponse, itemResponse, companyResponse] =
        await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Debtors`),
          api.get(`/companies/${companyId}/ledgers/with-balances`, { params: { to: form.date } }),
          api.get(`/companies/${companyId}/items`),
          api.get("/companies"),
        ]);
      setCreditTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "credit note")?._id || ""
      );
      setCustomers(customerResponse.data);
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
  const customerLedger = ledgerMap.get(form.customerLedger);
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
      customerLedger: "",
      returnLedger: "",
      narration: "",
      rows: [emptyRow],
    });

  const save = async () => {
    if (!creditTypeId) return alert("Credit note type missing");
    if (!form.customerLedger) return alert("Please select customer");
    if (!form.returnLedger) return alert("Please select return ledger");
    if (validRows.length === 0) return alert("Please add at least one item");

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: creditTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration || "Credit Note",
      lines: [
        { ledgerId: form.customerLedger, debit: totalAmount, credit: 0 },
        { ledgerId: form.returnLedger, debit: 0, credit: totalAmount },
      ],
      inventoryLines: validRows.map((row) => ({
        itemId: row.itemId,
        qty: Number(row.qty),
        rate: Number(row.rate),
        amount: lineAmount(row),
      })),
    });
    alert("Credit note saved");
    resetForm();
  };

  return (
    <VoucherWorkspace
      title="Credit Note"
      subtitle="Record sales returns and customer-side adjustments with dated item rates."
      icon={ReceiptText}
      iconTone="bg-rose-50 text-rose-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Credit Note"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Company", value: company?.name },
        { label: "Customer", value: customerLedger?.name || "-" },
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
            <label className="mb-2 block text-sm font-semibold text-slate-700">Customer</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.customerLedger}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, customerLedger: event.target.value }))
              }
            >
              <option value="">Select customer</option>
              {customers.map((ledger) => (
                <option key={ledger._id} value={ledger._id}>
                  {ledger.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {customerLedger
                ? renderBalance(
                    customerLedger.currentBalanceAbs,
                    customerLedger.currentBalanceSide,
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
          placeholder="Sales return against customer invoice."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
