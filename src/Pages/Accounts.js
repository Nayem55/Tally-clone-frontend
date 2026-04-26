import React, { useState, useEffect } from "react";
import axios from "axios";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import AdminSidebar from "../Component/AdminSidebar";

const Accounts = () => {
  const user = JSON.parse(localStorage.getItem("pos-user"));
  const [selectedType, setSelectedType] = useState("outlet"); // outlet, ASM, RSM, or Zone
  const [selectedArea, setSelectedArea] = useState(user.outlet || "");
  const [areaOptions, setAreaOptions] = useState([]);
  const [exportDropdown, setExportDropdown] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: dayjs().startOf("month").format("YYYY-MM-DD"),
    end: dayjs().endOf("month").format("YYYY-MM-DD"),
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null); // For modal image

  // Fetch area options based on selected type
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

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

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
      [
        "Date",
        "Type",
        "Amount",
        "Created By",
        "Payment Mode",
        "Bank",
        "Remarks",
      ],
    ];

    if (reportData.transactions) {
      reportData.transactions.forEach((txn) => {
        excelData.push([
          dayjs(txn.date).format("DD-MM-YY"),
          txn.type,
          txn.amount?.toFixed(2),
          txn.createdBy,
          txn.paymentMode || "",
          txn.bank || "",
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

    // === HEADER ===
    doc.text(
      `Dealer: ${reportData.transactions[0]?.outlet.replace("_", " ") || ""}`,
      marginX + 2,
      y,
    );
    doc.text(
      `Proprietor: ${reportData.transactions[0]?.SO.replace("_", " ") || ""}`,
      marginX + 2,
      y + 10,
    );
    doc.text(
      `Printed Date: ${dayjs().format("D-MMM-YY")}`,
      pageWidth - marginX - 2,
      y,
      { align: "right" },
    );
    doc.text(`Printed By: ${user.name}`, pageWidth - marginX - 2, y + 10, {
      align: "right",
    });
    y += 25;

    // === CENTERED SUBJECT & DATE RANGE ===
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

    // === LEFT-ALIGNED PARAGRAPHS ===
    const paragraphs = [
      "Given below is the details of your Accounts as standing in my/our Books of Accounts for the above mentioned period.",
      "Kindly return 3 copies stating your I.T. Permanent A/c No., duly signed and sealed, in confirmation of the same. Please note that if no reply is received from you within a fortnight, it will be assumed that you have accepted the balance shown below.",
    ];

    paragraphs.forEach((line, index) => {
      const split = doc.splitTextToSize(line, pageWidth - marginX * 2);
      split.forEach((l) => {
        doc.text(l, marginX, y);
        y += 6; // line spacing within the same paragraph
      });
      y += 4; // extra space *between* paragraphs only
    });
    y += 10;

    // === TRANSACTION DATA SPLIT ===
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
      const type = txn.type.toLowerCase();
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

    // === TABLE HEADER ===
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

    // === VERTICAL DIVIDER ===
    doc.setDrawColor(180);
    doc.line(verticalDividerX, headerBoxY - 6, verticalDividerX, y);

    // === TABLE BOTTOM BORDER ===
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;

    // === TOTALS ===
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

    // === CLOSING BALANCE ===
    const closing = totalDebit - totalCredit;
    doc.text("Closing Balance", colRightX + colWidths.date + colGap, y);
    doc.text(
      closing.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
      colRightX + colWidths.date + colWidths.particulars + colGap * 2 + 6,
      y,
      { align: "right" },
    );

    // === FOOTER ===
    y += 25;
    doc.setFont("times", "normal");
    doc.text("I/We hereby confirm the above", marginX, y);
    y += 20;
    doc.text("Yours faithfully,", marginX, y);
    doc.text("Authorized Signatory", marginX, y + 10);

    doc.save(`Ledger_${selectedArea}_${dayjs().format("YYYYMMDD")}.pdf`);
  };

  // Function to open image in modal
  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  // Function to close modal
  const closeImageModal = () => {
    setSelectedImage(null);
  };

  return (
    <div className="flex">
      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closeImageModal}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              className="absolute top-2 right-2 text-white bg-red-600 rounded-full p-1 z-10"
              onClick={closeImageModal}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-screen object-contain"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image
            />
          </div>
        </div>
      )}

      <div className="mx-auto px-6 py-8 w-full md:w-[80%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-800">
            Accounts
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

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
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

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && reportData && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white border-l-4 border-purple-600 p-4 rounded shadow">
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

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Transaction Table */}
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
                    <th className="border p-2">Payment Mode</th>
                    <th className="border p-2">Amount</th>
                    <th className="border p-2">Image</th>
                    <th className="border p-2">Created By</th>
                    <th className="border p-2">Remarks</th>
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
                      <td className="border p-2 capitalize">
                        {txn.paymentMode === "bank"
                          ? `Bank (${txn.bank.replace("_", " ") || "N/A"})`
                          : txn.paymentMode}
                      </td>
                      <td className="border p-2">{txn.amount?.toFixed(2)}</td>
                      <td className="border p-2 w-[40px]">
                        {txn.imageUrl && (
                          <img
                            alt="Transaction"
                            src={txn.imageUrl}
                            className="cursor-pointer h-10 w-10 object-cover"
                            onClick={() => openImageModal(txn.imageUrl)}
                          />
                        )}
                      </td>
                      <td className="border p-2">{txn.createdBy}</td>
                      <td className="border p-2">{txn.remarks || "-"}</td>
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
      </div>
    </div>
  );
};

export default Accounts;
