import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import AdminSidebar from "../Component/AdminSidebar";
import { toast } from "react-hot-toast";

const FinancialMovementReport = () => {
  const user = JSON.parse(localStorage.getItem("pos-user"));
  const [selectedType, setSelectedType] = useState("outlet");
  const [selectedArea, setSelectedArea] = useState(user.outlet || "");
  const [areaOptions, setAreaOptions] = useState([]);
  const [exportDropdown, setExportDropdown] = useState(false);
  const [outlets, setOutlets] = useState([]);
  const [outletSearch, setOutletSearch] = useState("");
  const [showOutletDropdown, setShowOutletDropdown] = useState(false);
  const outletDropdownRef = useRef(null);

  const [dateRange, setDateRange] = useState({
    start: dayjs().startOf("month").format("YYYY-MM-DD"),
    end: dayjs().endOf("month").format("YYYY-MM-DD"),
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    type: "",
    remarks: "",
  });
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingBreakdown, setOpeningBreakdown] = useState([]);

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    const response = await axios.get("http://175.29.181.245:15001/get-outlets");
    setOutlets(response.data);
  };

  useEffect(() => {
    const fetchAreaOptions = async () => {
      try {
        const response = await axios.get(
          "http://175.29.181.245:15001/api/area-options",
          { params: { type: selectedType } },
        );
        if (response.data?.success) {
          setAreaOptions(response.data.data);
          if (response.data.data.length > 0 && !selectedArea) {
            setSelectedArea(response.data.data[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching area options:", error);
      }
    };

    fetchAreaOptions();
  }, [selectedType]);

  useEffect(() => {
    if (
      (selectedArea || selectedType === "outlet") &&
      dateRange.start &&
      dateRange.end
    ) {
      fetchReportData();
    }
  }, [selectedArea, dateRange, selectedType]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        outletDropdownRef.current &&
        !outletDropdownRef.current.contains(event.target)
      ) {
        setShowOutletDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    setOpeningBreakdown([]);

    try {
      const params = {
        startDate: dayjs(dateRange.start).format("YYYY-MM-DD HH:mm:ss"),
        endDate: dayjs(dateRange.end).format("YYYY-MM-DD HH:mm:ss"),
      };

      let response;

      if (selectedType === "outlet") {
        params.outlet = selectedArea;
        response = await axios.get(
          "http://175.29.181.245:15001/api/financial-movement",
          { params },
        );
      } else {
        params.areaType = selectedType;
        params.areaValue = selectedArea;
        response = await axios.get(
          "http://175.29.181.245:15001/api/area-financial-movement",
          { params },
        );
      }

      if (response.data?.success) {
        setReportData(response.data.data);
        setOpeningBreakdown(response.data.data.openingBreakdown || []);
      } else {
        throw new Error(response.data?.message || "Invalid response format");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      let errorMessage = "Failed to load report data";
      if (error.response) {
        errorMessage =
          error.response.data?.message ||
          `Server error: ${error.response.status}`;
      }
      setError(errorMessage);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!reportData) return;

    const excelData = [
      [
        `${
          selectedType === "outlet" ? "Outlet" : selectedType
        }: ${selectedArea}`,
      ],
      [
        `Period: ${dayjs(dateRange.start).format("DD-MM-YY")} to ${dayjs(
          dateRange.end,
        ).format("DD-MM-YY")}`,
      ],
      [],
      ["Opening Due", reportData.openingDue?.toFixed(2)],
      ["Primary Added", reportData.primary?.toFixed(2)],
      ["Adjustments", reportData.adjustment?.toFixed(2)],
      ["Payments", reportData.payment?.toFixed(2)],
      ["Office Returns", reportData.officeReturn?.toFixed(2)],
      ["Closing Due", reportData.closingDue?.toFixed(2)],
      [],
      ["Transaction Details"],
      ["Date", "Dealer", "Type", "Amount", "Created By", "Remarks"], // Added "Dealer" column
    ];

    if (reportData.transactions) {
      reportData.transactions.forEach((txn) => {
        excelData.push([
          dayjs(txn.date).format("DD-MM-YY"),
          txn.outlet ? txn.outlet.replace("_", " ") : "", // Include outlet name, replace underscores
          txn.type,
          txn.amount?.toFixed(2),
          txn.createdBy,
          txn.remarks || "",
        ]);
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, "Financial Movement");
    XLSX.writeFile(
      wb,
      `Financial_Report_${selectedArea}_${dateRange.start}.xlsx`,
    );
  };
  const exportToPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;
    let y = 20;

    doc.setFont("times", "normal");
    doc.setFontSize(12);

    doc.text(
      `${selectedType === "outlet" ? "Dealer" : selectedType}: ${
        selectedArea || ""
      }`,
      marginX + 2,
      y,
    );
    doc.text(
      `Proprietor : ${reportData.transactions[0]?.SO || ""}`,
      marginX + 2,
      y + 10,
    );
    doc.text(
      `Printed Date : ${dayjs().format("D-MMM-YY")}`,
      pageWidth - marginX - 2,
      y,
      { align: "right" },
    );
    doc.text(`Printed By : ${user.name}`, pageWidth - marginX - 2, y + 10, {
      align: "right",
    });
    y += 25;

    doc.setFont("times", "bold");
    doc.text("Sub: Confirmation of Accounts", pageWidth / 2, y, {
      align: "center",
    });
    y += 6;

    doc.setFont("times", "normal");
    doc.text(
      `${dayjs(dateRange.start).format("D-MMM-YY")} to ${dayjs(
        dateRange.end,
      ).format("D-MMM-YY")}`,
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 10;

    const paragraphs = [
      "Given below is the details of your Accounts as standing in my/our Books of Accounts for the above mentioned period.",
      "Kindly return 3 copies stating your I.T. Permanent A/c No., duly signed and sealed, in confirmation of the same. Please note that if no reply is received from you within a fortnight, it will be assumed that you have accepted the balance shown below.",
    ];

    paragraphs.forEach((line, index) => {
      const split = doc.splitTextToSize(line, pageWidth - marginX * 2);
      split.forEach((l) => {
        doc.text(l, marginX, y);
        y += 6;
      });
      y += 4;
    });
    y += 10;

    const debit = [];
    const credit = [];

    if (reportData.openingDue > 0) {
      debit.push({
        date: dateRange.start,
        type: "Opening Balance",
        amount: reportData.openingDue,
      });
    }

    reportData.transactions.forEach((txn) => {
      const type = txn.type?.toLowerCase();
      if (["primary", "adjustment"].includes(type)) {
        debit.push({ date: txn.date, type: txn.type, amount: txn.amount });
      } else if (
        [
          "payment",
          "office return",
          "return",
          "sales return",
          "discount paid",
        ].includes(type)
      ) {
        credit.push({ date: txn.date, type: txn.type, amount: txn.amount });
      }
    });

    const maxRows = Math.max(debit.length, credit.length);
    const colGap = 5;
    const colLeftX = marginX;
    const colRightX = pageWidth / 2 + 2;
    const verticalDividerX = pageWidth / 2;
    const colWidths = { date: 24, particulars: 42, amount: 25 };

    const headerBoxY = y;
    const rowHeight = 8;
    doc.setDrawColor(0);
    doc.rect(colLeftX, y - 6, pageWidth - marginX * 2, rowHeight);

    doc.setFont("times", "bold");
    doc.text("Date", colLeftX + 1, y);
    doc.text("Particulars", colLeftX + colWidths.date + colGap, y);
    doc.text(
      "Debit Amount",
      colLeftX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
      y,
      { align: "right" },
    );

    doc.text("Date", colRightX + 1, y);
    doc.text("Particulars", colRightX + colWidths.date + colGap, y);
    doc.text(
      "Credit Amount",
      colRightX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
      y,
      { align: "right" },
    );

    y += 8;
    doc.setFont("times", "normal");

    let totalDebit = 0;
    let totalCredit = 0;

    for (let i = 0; i < maxRows; i++) {
      const d = debit[i];
      const c = credit[i];

      if (d) {
        doc.text(dayjs(d.date).format("D-MMM-YY"), colLeftX, y);
        doc.text(d.type, colLeftX + colWidths.date + colGap, y);
        doc.text(
          d.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          colLeftX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
          y,
          { align: "right" },
        );
        totalDebit += d.amount;
      }

      if (c) {
        doc.text(dayjs(c.date).format("D-MMM-YY"), colRightX, y);
        doc.text(c.type, colRightX + colWidths.date + colGap, y);
        doc.text(
          c.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          colRightX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
          y,
          { align: "right" },
        );
        totalCredit += c.amount;
      }

      y += 6;
    }

    doc.setDrawColor(180);
    doc.line(verticalDividerX, headerBoxY - 6, verticalDividerX, y);
    doc.line(marginX, y, pageWidth - marginX, y);

    y += 6;

    doc.setFont("times", "bold");
    doc.text("TOTAL", colLeftX + colWidths.date + colGap, y);
    doc.text(
      totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
      colLeftX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
      y,
      { align: "right" },
    );
    doc.text("TOTAL", colRightX + colWidths.date + colGap, y);
    doc.text(
      totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
      colRightX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
      y,
      { align: "right" },
    );

    y += 8;

    const closing = totalDebit - totalCredit;
    doc.text("Closing Balance", colRightX + colWidths.date + colGap, y);
    doc.text(
      closing.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
      colRightX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
      y,
      { align: "right" },
    );

    y += 25;
    doc.setFont("times", "normal");
    doc.text("I/We hereby confirm the above", marginX, y);
    y += 20;
    doc.text("Yours faithfully,", marginX, y);
    doc.text("Authorized Signatory", marginX, y + 10);

    doc.save(
      `Financial_Report_${selectedArea || "all"}_${dayjs().format(
        "YYYYMMDD",
      )}.pdf`,
    );
  };

  const handleEdit = (txn) => {
    setEditForm({
      amount: txn.amount,
      type: txn.type,
      remarks: txn.remarks || "",
    });
    setEditingTxn(txn);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    try {
      await axios.put(
        `http://175.29.181.245:15001/money-transaction/${editingTxn._id}`,
        editForm,
      );
      toast.success("Transaction updated successfully!");
      setEditingTxn(null);
      fetchReportData();
    } catch (error) {
      toast.error("Failed to update transaction");
      console.error("Error:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }
    try {
      await axios.delete(`http://175.29.181.245:15001/money-transaction/${id}`);
      toast.success("Transaction deleted successfully!");
      fetchReportData();
    } catch (error) {
      toast.error("Failed to delete transaction");
      console.error("Error:", error);
    }
  };

  const filteredOutlets = outlets.filter((outlet) =>
    outlet?.toLowerCase().includes(outletSearch?.toLowerCase()),
  );

  const handleOutletSelect = (outlet) => {
    setSelectedArea(outlet);
    setOutletSearch(outlet);
    setShowOutletDropdown(false);
  };

  return (
    <div className="flex">
      {!user?.outlet && <AdminSidebar />}

      <div className="mx-auto px-6 py-8 w-full md:w-[80%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            Financial Movement Report
          </h2>
          <div className="relative">
            <button
              onClick={() => setExportDropdown(!exportDropdown)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
              disabled={!reportData}
            >
              Export
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {exportDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      exportToExcel();
                      setExportDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export to Excel
                  </button>
                  <button
                    onClick={() => {
                      exportToPDF();
                      setExportDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export to PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedArea("");
              setOutletSearch("");
            }}
            className="px-4 py-2 border rounded-md shadow-sm"
          >
            <option value="outlet">Outlet Wise</option>
            <option value="ASM">ASM Wise</option>
            <option value="RSM">RSM Wise</option>
            <option value="Zone">Zone Wise</option>
          </select>

          {selectedType !== "outlet" && (
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-4 py-2 border rounded-md shadow-sm"
            >
              <option value="">Select {selectedType}</option>
              {areaOptions.map((area, index) => (
                <option key={index} value={area}>
                  {area}
                </option>
              ))}
            </select>
          )}

          {selectedType === "outlet" && !user?.outlet && (
            <div className="relative w-full max-w-xs" ref={outletDropdownRef}>
              <input
                type="text"
                value={outletSearch}
                onChange={(e) => {
                  setOutletSearch(e.target.value);
                  setShowOutletDropdown(true);
                }}
                onFocus={() => setShowOutletDropdown(true)}
                placeholder="Search Outlet..."
                className="w-full px-4 py-2 border rounded-md shadow-sm"
                aria-label="Search Outlet"
              />
              {showOutletDropdown && filteredOutlets.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredOutlets.map((outlet, index) => (
                    <div
                      key={index}
                      onClick={() => handleOutletSelect(outlet)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                      role="option"
                      aria-selected={selectedArea === outlet}
                    >
                      {outlet}
                    </div>
                  ))}
                </div>
              )}
              {showOutletDropdown &&
                outletSearch &&
                filteredOutlets.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg px-4 py-2 text-sm text-gray-500">
                    No outlets found
                  </div>
                )}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm">From:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange({ ...dateRange, start: e.target.value })
                }
                className="border rounded px-4 py-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">To:</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange({ ...dateRange, end: e.target.value })
                }
                className="border rounded px-4 py-2"
              />
            </div>
            <button
              onClick={fetchReportData}
              className="bg-blue-900 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && reportData && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div
              className="bg-white border-l-4 border-purple-600 p-4 rounded shadow"
              onClick={
                selectedType !== "outlet"
                  ? () => setShowOpeningModal(true)
                  : undefined
              }
              style={{
                cursor: selectedType !== "outlet" ? "pointer" : "default",
              }}
            >
              <p className="text-sm text-gray-600">Opening Balance</p>
              <p className="text-2xl font-semibold text-purple-700">
                {reportData.openingDue?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-blue-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Primary Added</p>
              <p className="text-2xl font-semibold text-blue-700">
                {reportData.primary?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-orange-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Adjustments</p>
              <p className="text-2xl font-semibold text-orange-700">
                {reportData.adjustment?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-green-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Payments</p>
              <p className="text-2xl font-semibold text-green-700">
                {reportData.payment?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-yellow-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Office Returns</p>
              <p className="text-2xl font-semibold text-yellow-700">
                {reportData.officeReturn?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-indigo-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Closing Due</p>
              <p className="text-2xl font-semibold text-indigo-700">
                {reportData.closingDue?.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && reportData?.transactions && (
          <div className="bg-white p-4 rounded shadow-md mb-6">
            <h3 className="text-lg font-bold mb-4">Transaction Details</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Date</th>
                    <th className="border p-2">Dealer</th>
                    <th className="border p-2">Type</th>
                    <th className="border p-2">Amount</th>
                    <th className="border p-2">Created By</th>
                    <th className="border p-2">Remarks</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.map((txn, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border p-2">
                        {dayjs(txn.date).format("DD-MM-YY")}
                      </td>
                      <td className="border p-2 capitalize">
                        {txn.outlet.replace("_", " ")}
                      </td>
                      <td className="border p-2 capitalize">
                        {txn.type.replace("_", " ")}
                      </td>
                      <td className="border p-2">{txn.amount?.toFixed(2)}</td>
                      <td className="border p-2">{txn.createdBy}</td>
                      <td className="border p-2">{txn.remarks || "-"}</td>
                      {user.role === "super admin" &&
                        (txn.type === "payment" ||
                          txn.type === "adjustment") && (
                          <td className="border p-2">
                            <button
                              onClick={() => handleEdit(txn)}
                              className="bg-blue-600 text-white px-2 py-1 rounded mr-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(txn._id)}
                              className="bg-red-600 text-white px-2 py-1 rounded"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !reportData && (
          <div className="text-center py-8 text-gray-500">
            No data available for selected period
          </div>
        )}

        {editingTxn && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Edit Transaction</h3>
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={editForm.amount}
                    onChange={handleEditChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    name="type"
                    value={editForm.type}
                    onChange={handleEditChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="primary">Primary</option>
                    <option value="payment">Payment</option>
                    <option value="office return">Office Return</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Remarks
                  </label>
                  <textarea
                    name="remarks"
                    value={editForm.remarks}
                    onChange={handleEditChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    rows="3"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTxn(null)}
                    className="bg-gray-600 text-white px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showOpeningModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
              <h3 className="text-lg font-bold mb-4">
                Opening Balance Breakdown
              </h3>
              <div className="overflow-y-auto max-h-96">
                <table className="min-w-full border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2">Outlet</th>
                      <th className="border p-2">Opening Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openingBreakdown.map((bd, index) => (
                      <tr key={index}>
                        <td className="border p-2 capitalize">
                          {bd.outlet.replace("_", " ")}
                        </td>
                        <td className="border p-2">
                          {bd.openingDue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowOpeningModal(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialMovementReport;
