import { useEffect, useState } from "react";
import api from "../api/api";

export default function VoucherCreate() {
  const [companyId, setCompanyId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);

  const [header, setHeader] = useState({
    voucherTypeId: "",
    number: "",
    date: new Date().toISOString().substring(0, 10),
    narration: "",
  });

  const [lines, setLines] = useState([
    { ledgerId: "", debit: "", credit: "" }
  ]);

  const load = async () => {
    if (!companyId) return;

    const l = await api.get(`/companies/${companyId}/ledgers`);
    const vt = await api.get(`/companies/${companyId}/voucher-types`);

    setLedgers(l.data);
    setVoucherTypes(vt.data);
  };

  useEffect(() => { load(); }, [companyId]);

  const addLine = () => {
    setLines([...lines, { ledgerId: "", debit: "", credit: "" }]);
  };

  const updateLine = (i, field, val) => {
    const newLines = [...lines];
    newLines[i][field] = val;
    setLines(newLines);
  };

  const saveVoucher = async () => {
    await api.post(`/companies/${companyId}/vouchers`, {
      ...header,
      lines
    });
    alert("Voucher saved");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Create Voucher</h1>

      <input
        className="border p-2 mb-4"
        placeholder="Company ID"
        value={companyId}
        onChange={e => setCompanyId(e.target.value)}
      />

      {companyId && (
        <div className="bg-white p-4 rounded shadow">

          <div className="mb-2">
            <label className="block font-semibold">Voucher Type</label>
            <select
              className="border p-2 w-full"
              value={header.voucherTypeId}
              onChange={e =>
                setHeader({ ...header, voucherTypeId: e.target.value })
              }
            >
              <option value="">Select type</option>
              {voucherTypes.map(v => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 mb-2">
            <input
              className="border p-2 w-1/2"
              placeholder="Voucher Number"
              value={header.number}
              onChange={e => setHeader({ ...header, number: e.target.value })}
            />
            <input
              type="date"
              className="border p-2 w-1/2"
              value={header.date}
              onChange={e => setHeader({ ...header, date: e.target.value })}
            />
          </div>

          <textarea
            className="border p-2 w-full mb-2"
            placeholder="Narration"
            value={header.narration}
            onChange={e => setHeader({ ...header, narration: e.target.value })}
          />

          {/* Voucher Lines */}
          <table className="w-full border mb-3">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Ledger</th>
                <th className="border p-2">Debit</th>
                <th className="border p-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="border p-2">
                    <select
                      className="border p-1"
                      value={l.ledgerId}
                      onChange={e => updateLine(i, "ledgerId", e.target.value)}
                    >
                      <option value="">Select Ledger</option>
                      {ledgers.map(ledger => (
                        <option key={ledger._id} value={ledger._id}>
                          {ledger.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border p-2">
                    <input
                      className="border p-1 w-full"
                      type="number"
                      value={l.debit}
                      onChange={e => updateLine(i, "debit", e.target.value)}
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      className="border p-1 w-full"
                      type="number"
                      value={l.credit}
                      onChange={e => updateLine(i, "credit", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className="bg-gray-700 text-white px-4 py-2 rounded mr-3"
            onClick={addLine}
          >
            + Add Line
          </button>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={saveVoucher}
          >
            Save Voucher
          </button>

        </div>
      )}
    </div>
  );
}
