import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import AdminSidebar from "../Component/AdminSidebar";

const CategoryStockMovementReport = () => {
  const user = JSON.parse(localStorage.getItem("pos-user"));
  const [selectedCategory, setSelectedCategory] = useState("");
  const [exportDropdown, setExportDropdown] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState(""); // State for category search query
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false); // State for category dropdown visibility
  const categoryDropdownRef = useRef(null); // Ref for handling click outside
  const [dateRange, setDateRange] = useState({
    start: dayjs().startOf("month").format("YYYY-MM-DD"),
    end: dayjs().endOf("month").format("YYYY-MM-DD"),
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory && dateRange.start && dateRange.end) {
      fetchReportData();
    }
  }, [selectedCategory, dateRange.start, dateRange.end]);

  // Handle click outside to close category dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target)
      ) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!dateRange.start || !dateRange.end) {
        throw new Error("Please select both start and end dates");
      }

      const params = {
        category: selectedCategory,
        startDate: dayjs(dateRange.start).format("YYYY-MM-DD HH:mm:ss"),
        endDate: dayjs(dateRange.end).format("YYYY-MM-DD HH:mm:ss"),
      };

      const response = await axios.get(
        "http://175.29.181.245:15001/api/category-stock-movement",
        { params },
      );

      if (response.data?.success) {
        const filteredData = response.data.data.filter((item) => {
          return (
            (item.openingStock && item.openingStock !== 0) ||
            (item.primary && item.primary !== 0) ||
            (item.secondary && item.secondary !== 0) ||
            (item.officeReturn && item.officeReturn !== 0) ||
            (item.marketReturn && item.marketReturn !== 0)
          );
        });
        const sortedData = [...filteredData].sort((a, b) =>
          a.outlet.localeCompare(b.outlet),
        );
        setReportData(sortedData);
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
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const response = await axios.get(
      "http://175.29.181.245:15001/product-categories",
    );
    setCategories(response.data);
  };

  const handleFilterClick = () => {
    fetchReportData();
  };

  const exportToExcel = () => {
    const sortedData = [...reportData].sort((a, b) =>
      a.outlet.localeCompare(b.outlet),
    );
    const excelData = [
      [
        `Category: ${selectedCategory}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        `Period: ${
          dayjs(dateRange.start).format("DD-MM-YY") +
          " to " +
          dayjs(dateRange.end).format("DD-MM-YY")
        }`,
      ],
      ["", "", "", "", "", "", "", "", "", ""],
      [
        "Sl",
        "Dealer Name",
        "Opening Stock",
        "",
        "Primary",
        "",
        "Market Return",
        "",
        "Office Return",
        "",
        "Secondary",
        "",
        "Actual Secondary",
        "",
        "Closing Stock",
        "",
      ],
      [
        "",
        "",
        "Qty",
        "Value (TP)",
        "Qty",
        "Value (TP)",
        "Qty",
        "Value (TP)",
        "Qty",
        "Value (TP)",
        "Qty",
        "Value (TP)",
        "Qty",
        "Value (TP)",
        "Qty",
        "Value (TP)",
      ],
      ...sortedData.map((item, index) => [
        index + 1,
        item.outlet,
        item.openingStock,
        item.openingValueTP?.toFixed(2),
        item.primary,
        item.primaryValueTP?.toFixed(2),
        item.marketReturn,
        item.marketReturnValueTP?.toFixed(2),
        item.officeReturn,
        item.officeReturnValueTP?.toFixed(2),
        item.secondary,
        item.secondaryValueTP?.toFixed(2),
        item.secondary - item.marketReturn,
        (item.secondaryValueTP - item.marketReturnValueTP)?.toFixed(2),
        item.openingStock +
          item.primary +
          item.marketReturn -
          item.secondary -
          item.officeReturn,
        (
          item.openingValueTP +
          item.primaryValueTP +
          item.marketReturnValueTP -
          item.secondaryValueTP -
          item.officeReturnValueTP
        )?.toFixed(2),
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 0, c: 9 }, e: { r: 0, c: 15 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 1, c: 9 }, e: { r: 1, c: 15 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 3 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
      { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } },
      { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } },
      { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
      { s: { r: 2, c: 12 }, e: { r: 2, c: 13 } },
      { s: { r: 2, c: 14 }, e: { r: 2, c: 15 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Category Stock Movement");
    XLSX.writeFile(
      wb,
      `Category_Stock_Movement_${selectedCategory}_${dateRange.start}.xlsx`,
    );
  };

  const exportToPDF = () => {
    const sortedData = [...reportData].sort((a, b) =>
      a.outlet.localeCompare(b.outlet),
    );
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
      });

      doc.setFontSize(12);
      doc.text(`Category: ${selectedCategory || ""}`, 14, 15);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(
        `Period: ${
          dayjs(dateRange.start).format("DD-MM-YY") +
          " to " +
          dayjs(dateRange.end).format("DD-MM-YY")
        }`,
        pageWidth - 75,
        15,
      );

      const headers = [
        [
          "Sl",
          "Dealer Name",
          "Opening Stock",
          "",
          "Primary",
          "",
          "Market Return",
          "",
          "Office Return",
          "",
          "Secondary",
          "",
          "Actual Secondary",
          "",
          "Closing Stock",
          "",
        ],
        [
          "",
          "",
          "Qty",
          "Value (TP)",
          "Qty",
          "Value (TP)",
          "Qty",
          "Value (TP)",
          "Qty",
          "Value (TP)",
          "Qty",
          "Value (TP)",
          "Qty",
          "Value (TP)",
          "Qty",
          "Value (TP)",
        ],
      ];

      const data = sortedData.map((item, index) => [
        index + 1,
        item.outlet || "",
        item.openingStock || 0,
        item.openingValueTP?.toFixed(2) || "0.00",
        item.primary || 0,
        item.primaryValueTP?.toFixed(2) || "0.00",
        item.marketReturn || 0,
        item.marketReturnValueTP?.toFixed(2) || "0.00",
        item.officeReturn || 0,
        item.officeReturnValueTP?.toFixed(2) || "0.00",
        item.secondary || 0,
        item.secondaryValueTP?.toFixed(2) || "0.00",
        item.secondary - item.marketReturn || 0,
        (item.secondaryValueTP - item.marketReturnValueTP)?.toFixed(2) ||
          "0.00",
        item.openingStock +
          item.primary +
          item.marketReturn -
          item.secondary -
          item.officeReturn || 0,
        (
          item.openingValueTP +
          item.primaryValueTP +
          item.marketReturnValueTP -
          item.secondaryValueTP -
          item.officeReturnValueTP
        )?.toFixed(2) || "0.00",
      ]);

      if (totals) {
        data.push([
          "",
          "TOTAL",
          totals.openingQty || 0,
          totals.openingValue?.toFixed(2) || "0.00",
          totals.primaryQty || 0,
          totals.primaryValue?.toFixed(2) || "0.00",
          totals.marketReturnQty || 0,
          totals.marketReturnValue?.toFixed(2) || "0.00",
          totals.officeReturnQty || 0,
          totals.officeReturnValue?.toFixed(2) || "0.00",
          totals.secondaryQty || 0,
          totals.secondaryValue?.toFixed(2) || "0.00",
          totals.actualSecondaryQty || 0,
          totals.actualSecondaryValue?.toFixed(2) || "0.00",
          totals.closingQty || 0,
          totals.closingValue?.toFixed(2) || "0.00",
        ]);
      }

      autoTable(doc, {
        head: headers,
        body: data,
        startY: 30,
        margin: { horizontal: 10 },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: "linebreak",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 30, halign: "left" },
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        didParseCell: function (data) {
          if (data.section === "head" && data.row.index === 0) {
            if (
              data.column.dataKey === 2 ||
              data.column.dataKey === 4 ||
              data.column.dataKey === 6 ||
              data.column.dataKey === 8 ||
              data.column.dataKey === 10 ||
              data.column.dataKey === 12 ||
              data.column.dataKey === 14
            ) {
              data.cell.colSpan = 2;
            }
          }
        },
      });

      const fileName = `Category_Stock_Report_${selectedCategory || "all"}_${
        dayjs(dateRange.start).format("YYYY-MM-DD") +
          " to " +
          dayjs(dateRange.end).format("YYYY-MM-DD") || dayjs().format("MMMM")
      }_${dayjs().format("YYYYMMDD")}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const totals = reportData.reduce(
    (acc, item) => {
      acc.openingQty += item.openingStock || 0;
      acc.openingValue += item.openingValueTP || 0;
      acc.primaryQty += item.primary || 0;
      acc.primaryValue += item.primaryValueTP || 0;
      acc.marketReturnQty += item.marketReturn || 0;
      acc.marketReturnValue += item.marketReturnValueTP || 0;
      acc.officeReturnQty += item.officeReturn || 0;
      acc.officeReturnValue += item.officeReturnValueTP || 0;
      acc.secondaryQty += item.secondary || 0;
      acc.secondaryValue += item.secondaryValueTP || 0;
      acc.actualSecondaryQty += item.secondary - item.marketReturn || 0;
      acc.actualSecondaryValue +=
        item.secondaryValueTP - item.marketReturnValueTP || 0;
      acc.closingQty +=
        item.openingStock +
          item.primary +
          item.marketReturn -
          item.secondary -
          item.officeReturn || 0;
      acc.closingValue +=
        item.openingValueTP +
          item.primaryValueTP +
          item.marketReturnValueTP -
          item.secondaryValueTP -
          item.officeReturnValueTP || 0;
      return acc;
    },
    {
      openingQty: 0,
      openingValue: 0,
      primaryQty: 0,
      primaryValue: 0,
      marketReturnQty: 0,
      marketReturnValue: 0,
      officeReturnQty: 0,
      officeReturnValue: 0,
      secondaryQty: 0,
      secondaryValue: 0,
      actualSecondaryQty: 0,
      actualSecondaryValue: 0,
      closingQty: 0,
      closingValue: 0,
    },
  );

  // Filter categories based on search query
  const filteredCategories = categories.filter((category) =>
    category?.toLowerCase().includes(categorySearch?.toLowerCase()),
  );

  // Handle category selection
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setCategorySearch(category);
    setShowCategoryDropdown(false);
  };

  return (
    <div className="flex">
      {!user?.outlet && <AdminSidebar />}

      <div className="mx-auto px-6 py-8 w-full md:w-[80%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            Category Stock Movement Report
          </h2>
          <div className="relative">
            <button
              onClick={() => setExportDropdown(!exportDropdown)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
              disabled={reportData.length === 0}
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
          <div className="relative w-full max-w-xs" ref={categoryDropdownRef}>
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => {
                setCategorySearch(e.target.value);
                setShowCategoryDropdown(true);
              }}
              onFocus={() => setShowCategoryDropdown(true)}
              placeholder="Search Category..."
              className="w-full px-4 py-2 border rounded-md shadow-sm"
              aria-label="Search Category"
            />
            {showCategoryDropdown && filteredCategories.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredCategories.map((category, index) => (
                  <div
                    key={index}
                    onClick={() => handleCategorySelect(category)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                    role="option"
                    aria-selected={selectedCategory === category}
                  >
                    {category}
                  </div>
                ))}
              </div>
            )}
            {showCategoryDropdown &&
              categorySearch &&
              filteredCategories.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg px-4 py-2 text-sm text-gray-500">
                  No categories found
                </div>
              )}
          </div>
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
              onClick={handleFilterClick}
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

        {!loading && reportData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
            <div className="bg-white border-l-4 border-purple-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Opening Stock (TP)</p>
              <p className="text-2xl font-semibold text-purple-700">
                {totals.openingValue?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-green-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Primary Stock (TP)</p>
              <p className="text-2xl font-semibold text-green-700">
                {totals.primaryValue?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-blue-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Secondary Sales (TP)</p>
              <p className="text-2xl font-semibold text-blue-700">
                {totals.secondaryValue?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-red-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Market Returns (TP)</p>
              <p className="text-2xl font-semibold text-red-700">
                {totals.marketReturnValue?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-yellow-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Office Returns (TP)</p>
              <p className="text-2xl font-semibold text-yellow-700">
                {totals.officeReturnValue?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-teal-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Actual Secondary (TP)</p>
              <p className="text-2xl font-semibold text-teal-700">
                {totals.actualSecondaryValue?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border-l-4 border-indigo-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Closing Stock (TP)</p>
              <p className="text-2xl font-semibold text-indigo-700">
                {totals.closingValue?.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && reportData.length > 0 && (
          <div
            className="overflow-x-auto shadow rounded-lg"
            style={{ maxHeight: "95vh" }}
          >
            <table className="min-w-full border">
              <thead className="sticky top-[-1px] bg-white z-10">
                <tr>
                  <th colSpan="16" className="bg-gray-200 px-4 py-2 text-left">
                    Category: {selectedCategory}
                  </th>
                </tr>
                <tr>
                  <th colSpan="16" className="bg-gray-200 px-4 py-3 text-left">
                    Period: {dayjs(dateRange.start).format("DD-MM-YY")} to{" "}
                    {dayjs(dateRange.end).format("DD-MM-YY")}
                  </th>
                </tr>
                <tr className="bg-gray-100">
                  <th rowSpan="2" className="p-2 sticky top-22 bg-gray-100">
                    Sl
                  </th>
                  <th rowSpan="2" className="p-2 sticky top-22 bg-gray-100">
                    Dealer Name
                  </th>
                  <th
                    colSpan="2"
                    className="p-2 text-center sticky top-24 bg-gray-100"
                  >
                    Opening Stock
                  </th>
                  <th
                    colSpan="2"
                    className="p-2 text-center sticky top-24 bg-gray-100"
                  >
                    Primary
                  </th>
                  <th
                    colSpan="2"
                    className="p-2 text-center sticky top-24 bg-gray-100"
                  >
                    Market Return
                  </th>
                  <th
                    colSpan="2"
                    className="p-2 text-center sticky top-24 bg-gray-100"
                  >
                    Office Return
                  </th>
                  <th
                    colSpan="2"
                    className="p-2 text-center sticky top-24 bg-gray-100"
                  >
                    Secondary
                  </th>
                  <th
                    colSpan="2"
                    className="p-2 text-center sticky top-24 bg-gray-100"
                  >
                    Actual Secondary
                  </th>
                  <th
                    colSpan="2"
                    className="p-2 text-center sticky top-24 bg-gray-100"
                  >
                    Closing Stock
                  </th>
                </tr>
                <tr className="bg-gray-100 sticky top-32">
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value (TP)</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value (TP)</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value (TP)</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value (TP)</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value (TP)</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value (TP)</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value (TP)</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item, index) => (
                  <tr key={item.outlet} className="hover:bg-gray-50">
                    <td className="border p-2">{index + 1}</td>
                    <td className="border p-2">{item.outlet}</td>
                    <td className="border p-2 text-right">
                      {item.openingStock} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.openingValueTP?.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {item.primary} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.primaryValueTP?.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {item.marketReturn} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.marketReturnValueTP?.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {item.officeReturn} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.officeReturnValueTP?.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {item.secondary} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.secondaryValueTP?.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {item.secondary - item.marketReturn} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {(
                        item.secondaryValueTP - item.marketReturnValueTP
                      )?.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {item.openingStock +
                        item.primary +
                        item.marketReturn -
                        item.secondary -
                        item.officeReturn}{" "}
                      pcs
                    </td>
                    <td className="border p-2 text-right">
                      {(
                        item.openingValueTP +
                        item.primaryValueTP +
                        item.marketReturnValueTP -
                        item.secondaryValueTP -
                        item.officeReturnValueTP
                      )?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-[-1px] bg-gray-100">
                <tr className="font-bold">
                  <td className="p-2" colSpan="2">
                    Total
                  </td>
                  <td className="p-2 text-right">{totals.openingQty}</td>
                  <td className="p-2 text-right">
                    {totals.openingValue.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{totals.primaryQty}</td>
                  <td className="p-2 text-right">
                    {totals.primaryValue.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{totals.marketReturnQty}</td>
                  <td className="p-2 text-right">
                    {totals.marketReturnValue.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{totals.officeReturnQty}</td>
                  <td className="p-2 text-right">
                    {totals.officeReturnValue.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{totals.secondaryQty}</td>
                  <td className="p-2 text-right">
                    {totals.secondaryValue.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">
                    {totals.actualSecondaryQty}
                  </td>
                  <td className="p-2 text-right">
                    {totals.actualSecondaryValue.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{totals.closingQty}</td>
                  <td className="p-2 text-right">
                    {totals.closingValue.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && reportData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No data available for selected period
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryStockMovementReport;
