import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  PackageSearch,
  Boxes,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Calendar,
  X,
  BarChart2,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";

const SearchableSelect = ({
  options,
  selectedValue,
  onChange,
  placeholder,
  disabled,
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const currentLabel =
    options.find((opt) => opt.value === selectedValue)?.label || placeholder;

  if (disabled) {
    return (
      <button
        disabled
        className="px-4 py-2 border rounded-md shadow-sm bg-gray-100 text-gray-500 w-full md:w-48 lg:w-64 text-left"
      >
        {placeholder}
      </button>
    );
  }

  return (
    <div className="relative w-full md:w-48 lg:w-64">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 border rounded-md shadow-sm bg-white w-full text-left focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors duration-200 flex justify-between items-center"
      >
        <span className="truncate">{currentLabel}</span>
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
            d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
          />
        </svg>
      </button>
      {open && (
        <div className="absolute w-full mt-1 bg-white border rounded-md shadow-lg z-30 max-h-60 overflow-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-4 py-2 border-b focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <ul>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors duration-150 truncate"
                >
                  {opt.label}
                </li>
              ))
            ) : (
              <li className="px-4 py-2 text-gray-500">No options found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function AdminHomePage() {
  // Filters
  const [selectedZone, setSelectedZone] = useState("Mirpur");
  const [selectedZoneName, setSelectedZoneName] = useState("Mirpur");
  const [zones, setZones] = useState([]);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29); // last 30 days
    return { from: toYMD(start), to: toYMD(end) };
  });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [exportDropdown, setExportDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");

  // Data state
  const [skuRows, setSkuRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ type: "", details: [] });

  // Fetch zones
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await axios.get(
          "http://175.29.181.245:15001/api/area-options",
          { params: { type: "Zone" } },
        );
        setZones(response.data.data);
        if (response.data.data.includes("Mirpur")) {
          setSelectedZone("Mirpur");
          setSelectedZoneName("Mirpur");
        }
      } catch (error) {
        console.error("Fetch zones error:", error);
        setError("Failed to load zones");
      }
    };
    fetchZones();
  }, []);

  // Define filteredCategories and filteredBrands
  const filteredCategories = useMemo(() => {
    if (selectedBrand === "all") {
      return categories;
    }
    const relevantCats = [
      ...new Set(
        skuRows
          .filter((item) => item.brand === selectedBrand)
          .map((item) => item.category || "Uncategorized"),
      ),
    ].sort();
    return [
      { value: "all", label: "All Categories" },
      ...relevantCats.map((c) => ({ value: c, label: c })),
    ];
  }, [selectedBrand, categories, skuRows]);

  const filteredBrands = useMemo(() => {
    if (selectedCategory === "all") {
      return brands;
    }
    const relevantBrands = [
      ...new Set(
        skuRows
          .filter((item) => item.category === selectedCategory)
          .map((item) => item.brand || "Unbranded"),
      ),
    ].sort();
    return [
      { value: "all", label: "All Brands" },
      ...relevantBrands.map((b) => ({ value: b, label: b })),
    ];
  }, [selectedCategory, brands, skuRows]);

  // Reset selectedCategory if it becomes invalid
  useEffect(() => {
    const catValues = filteredCategories.map((o) => o.value);
    if (selectedCategory !== "all" && !catValues.includes(selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [filteredCategories, selectedCategory]);

  // Reset selectedBrand if it becomes invalid
  useEffect(() => {
    const brandValues = filteredBrands.map((o) => o.value);
    if (selectedBrand !== "all" && !brandValues.includes(selectedBrand)) {
      setSelectedBrand("all");
    }
  }, [filteredBrands, selectedBrand]);

  const periodDays = useMemo(
    () => daysBetween(dateRange.from, dateRange.to),
    [dateRange],
  );

  const normalizeAreaRows = useCallback((rows) => {
    return rows.map((r) => ({
      barcode: r.barcode,
      productName: r.productName || "Unknown",
      category: r.category || "Uncategorized",
      brand: r.brand || "Unbranded",
      openingStock: num(r.openingStock),
      primary: num(r.primary),
      secondary: num(r.secondary),
      marketReturn: num(r.marketReturn),
      officeReturn: num(r.officeReturn),
      closingStock: num(r.closingStock),
      primaryStocks: r.primaryStocks || [],
      secondarySales: r.secondarySales || [],
      marketReturnTransfers: r.marketReturnTransfers || [],
      officeReturnTransfers: r.officeReturnTransfers || [],
    }));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "http://175.29.181.245:15001/api/area-stock-movement";
      let params = {
        startDate: dayjs(dateRange.from).format("YYYY-MM-DD HH:mm:ss"),
        endDate: dayjs(dateRange.to).format("YYYY-MM-DD HH:mm:ss"),
      };

      let allRows = [];
      if (selectedZone === "all") {
        params.areaType = "Zone";
        for (const zone of zones) {
          params.areaValue = zone;
          const res = await axios.get(url, { params });
          if (res.data.success) {
            allRows.push(...(res.data.data || []));
          }
        }
      } else {
        params.areaType = "Zone";
        params.areaValue = selectedZone;
        const res = await axios.get(url, { params });
        if (res.data.success) {
          allRows = res.data.data || [];
        } else {
          throw new Error(res.data?.message || "Invalid response format");
        }
      }

      const rows = normalizeAreaRows(allRows);

      // Aggregate by barcode to merge same products
      const skuMap = new Map();
      for (const row of rows) {
        const barcode = row.barcode;
        if (!skuMap.has(barcode)) {
          skuMap.set(barcode, {
            ...row,
            primaryStocks: [...row.primaryStocks],
            secondarySales: [...row.secondarySales],
            marketReturnTransfers: [...row.marketReturnTransfers],
            officeReturnTransfers: [...row.officeReturnTransfers],
          });
        } else {
          const agg = skuMap.get(barcode);
          agg.openingStock += row.openingStock;
          agg.primary += row.primary;
          agg.secondary += row.secondary;
          agg.marketReturn += row.marketReturn;
          agg.officeReturn += row.officeReturn;
          agg.closingStock += row.closingStock;
          agg.primaryStocks.push(...row.primaryStocks);
          agg.secondarySales.push(...row.secondarySales);
          agg.marketReturnTransfers.push(...row.marketReturnTransfers);
          agg.officeReturnTransfers.push(...row.officeReturnTransfers);
        }
      }
      const aggregatedRows = Array.from(skuMap.values());

      setSkuRows(aggregatedRows);

      const uniqueCategories = [
        ...new Set(
          aggregatedRows.map((item) => item.category || "Uncategorized"),
        ),
      ].sort();
      setCategories([
        { value: "all", label: "All Categories" },
        ...uniqueCategories.map((c) => ({ value: c, label: c })),
      ]);

      const uniqueBrands = [
        ...new Set(aggregatedRows.map((item) => item.brand || "Unbranded")),
      ].sort();
      setBrands([
        { value: "all", label: "All Brands" },
        ...uniqueBrands.map((b) => ({ value: b, label: b })),
      ]);
    } catch (e) {
      setError(e.message || "Failed to load data");
      setSkuRows([]);
      setCategories([]);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [selectedZone, dateRange, normalizeAreaRows, zones]);

  // Fetch when filters change
  useEffect(() => {
    if (dateRange.from && dateRange.to && zones.length > 0) {
      fetchData();
    }
  }, [fetchData, zones]);

  const filteredSkuRows = useMemo(
    () =>
      skuRows.filter(
        (r) =>
          (selectedCategory === "all" || r.category === selectedCategory) &&
          (selectedBrand === "all" || r.brand === selectedBrand),
      ),
    [skuRows, selectedCategory, selectedBrand],
  );

  const categoryRows = useMemo(
    () =>
      groupByKey(
        filteredSkuRows.filter((r) =>
          r.category.toLowerCase().includes(categorySearch.toLowerCase()),
        ),
        "category",
        periodDays,
      ),
    [filteredSkuRows, periodDays, categorySearch],
  );

  const brandRows = useMemo(
    () =>
      groupByKey(
        filteredSkuRows.filter((r) =>
          r.brand.toLowerCase().includes(brandSearch.toLowerCase()),
        ),
        "brand",
        periodDays,
      ),
    [filteredSkuRows, periodDays, brandSearch],
  );

  const totals = useMemo(() => sumRows(categoryRows), [categoryRows]);

  // Movement & insights
  const topOutwards = useMemo(
    () => [...filteredSkuRows].sort((a, b) => b.secondary - a.secondary),
    [filteredSkuRows],
  );
  const notMoving = useMemo(
    () =>
      filteredSkuRows
        .filter((r) => r.primary === 0 && r.secondary === 0)
        .sort((a, b) => a.productName.localeCompare(b.productName)),
    [filteredSkuRows],
  );
  const minStock = useMemo(
    () =>
      [...filteredSkuRows]
        .sort((a, b) => a.closingStock - b.closingStock)
        .filter((s) => s.closingStock > 0),
    [filteredSkuRows],
  );
  const overStockTop100 = useMemo(
    () =>
      [...filteredSkuRows]
        .sort((a, b) => b.closingStock - a.closingStock)
        .slice(0, 100),
    [filteredSkuRows],
  );
  const outwardsVsStock = useMemo(
    () =>
      filteredSkuRows
        .map((r) => outwardsStockRow(r, periodDays))
        .filter((r) => r.onhand > 0 && r.outwards > 0)
        .sort((a, b) => b.coverDays - a.coverDays),
    [filteredSkuRows, periodDays],
  );

  const kpis = useMemo(
    () => [
      {
        key: "opening",
        label: "Opening Stock",
        value: totals.opening,
        icon: Boxes,
        tone: "from-blue-500/10 to-blue-500/5",
        text: "text-blue-600",
      },
      {
        key: "primary",
        label: "Primary Sales",
        value: totals.inwards,
        icon: TrendingUp,
        tone: "from-emerald-500/10 to-emerald-500/5",
        text: "text-emerald-600",
        clickable: true,
      },
      {
        key: "secondary",
        label: "Secondary Sales",
        value: totals.outwards,
        icon: TrendingDown,
        tone: "from-rose-500/10 to-rose-500/5",
        text: "text-rose-600",
        clickable: true,
      },
      {
        key: "marketReturn",
        label: "Market Return",
        value: totals.transferIn,
        icon: RefreshCw,
        tone: "from-cyan-500/10 to-cyan-500/5",
        text: "text-cyan-600",
        clickable: true,
      },
      {
        key: "officeReturn",
        label: "Office Return",
        value: totals.transferOut,
        icon: RefreshCw,
        tone: "from-red-500/10 to-red-500/5",
        text: "text-red-600",
        clickable: true,
      },
      {
        key: "actualSecondary",
        label: "Actual Secondary",
        value: totals.outwards - totals.transferIn,
        icon: TrendingDown,
        tone: "from-indigo-500/10 to-indigo-500/5",
        text: "text-indigo-600",
      },
      {
        key: "closing",
        label: "Closing Stock",
        value: totals.closing,
        icon: PackageSearch,
        tone: "from-violet-500/10 to-violet-500/5",
        text: "text-violet-700",
      },
    ],
    [totals],
  );

  const openModal = (type, details) => {
    setModalData({ type, details });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalData({ type: "", details: [] });
  };

  const exportModalToExcel = () => {
    const isDetailsView = modalData.type.includes(" - ");
    const exportType = isDetailsView
      ? modalData.type.split(" - ")[0]
      : modalData.type;
    const hasInvoice = ["Primary Sales", "Secondary Sales"].includes(
      exportType,
    );
    const isAllZones = selectedZone === "all";
    let excelData = [];

    if (isDetailsView) {
      const sortedDetails = [...modalData.details].sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
      const headers = [
        "Date",
        ...(hasInvoice ? ["Invoice"] : []),
        ...(isAllZones ? ["Zone"] : []),
        "Quantity",
      ];
      const dataRows = sortedDetails.map((detail) => [
        dayjs(detail.date).format("DD-MM-YYYY"),
        ...(hasInvoice ? [detail.invoice || "N/A"] : []),
        ...(isAllZones ? [detail.outlet || "N/A"] : []),
        `${detail.quantity?.toFixed(2)}`,
      ]);

      excelData = [[modalData.type], [], headers, ...dataRows];
    } else {
      const groupedDetails = modalData.details.reduce((acc, detail) => {
        const key = getDetailKey(exportType, detail);
        if (!acc[key]) {
          acc[key] = { name: key, value: 0, details: [] };
        }
        acc[key].value += detail.quantity || 0;
        acc[key].details.push(detail);
        return acc;
      }, {});

      const sortedGroups = Object.values(groupedDetails).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      const groupKey = getGroupKey(exportType);
      const headers = [groupKey, "Quantity"];
      const dataRows = sortedGroups.map((group) => [
        group.name,
        `${group.value?.toFixed(2)}`,
      ]);

      excelData = [[modalData.type], [], headers, ...dataRows];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, "Details");
    XLSX.writeFile(
      wb,
      `${modalData.type.replace(/ /g, "_")}_${dayjs().format("YYYYMMDD")}.xlsx`,
    );
  };

  const getGroupKey = (type) => {
    if (type === "Primary Sales") return "Product Name";
    if (type === "Secondary Sales") return "Party Name";
    if (type === "Market Return") return "Source Outlet";
    if (type === "Office Return") return "Destination Outlet";
    return "Unknown";
  };

  const getDetailKey = (type, detail) => {
    if (type === "Primary Sales") return detail.productName;
    if (type === "Secondary Sales") return detail.partyName;
    if (type === "Market Return") return detail.source;
    if (type === "Office Return") return detail.destination;
    return "Unknown";
  };

  const exportToExcel = () => {
    const excelData = [
      [
        `${selectedZoneName} POS Dashboard Report`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        `Period: ${
          dayjs(dateRange.from).format("DD-MM-YY") +
          " to " +
          dayjs(dateRange.to).format("DD-MM-YY")
        }`,
      ],
      ["", "", "", "", "", "", "", "", ""],
      [
        "Category",
        "Opening Stock",
        "Primary Sales",
        "Secondary Sales",
        "Market Return",
        "Office Return",
        "Actual Secondary",
        "Closing Stock",
      ],
    ];

    excelData.push(
      ...categoryRows.map((c) => [
        c.key,
        c.opening?.toFixed(2),
        c.inwards?.toFixed(2),
        c.outwards?.toFixed(2),
        c.transferIn?.toFixed(2),
        c.transferOut?.toFixed(2),
        (c.outwards - c.transferIn)?.toFixed(2),
        c.closing?.toFixed(2),
      ]),
    );

    excelData.push([
      "Total",
      totals.opening?.toFixed(2),
      totals.inwards?.toFixed(2),
      totals.outwards?.toFixed(2),
      totals.transferIn?.toFixed(2),
      totals.transferOut?.toFixed(2),
      (totals.outwards - totals.transferIn)?.toFixed(2),
      totals.closing?.toFixed(2),
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 0, c: 8 }, e: { r: 0, c: 8 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "POS Dashboard");
    XLSX.writeFile(
      wb,
      `${selectedZoneName.replace(/ /g, "_")}_POS_Dashboard_${dayjs(dateRange.from).format("YYYYMMDD")}.xlsx`,
    );
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
      });

      doc.setFontSize(12);
      doc.text(`${selectedZoneName} POS Dashboard Report`, 14, 15);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(
        `Period: ${
          dayjs(dateRange.from).format("DD-MM-YY") +
          " to " +
          dayjs(dateRange.to).format("DD-MM-YY")
        }`,
        pageWidth - 75,
        15,
      );

      const headers = [
        [
          "Category",
          "Opening Stock",
          "Primary Sales",
          "Secondary Sales",
          "Market Return",
          "Office Return",
          "Actual Secondary",
          "Closing Stock",
        ],
      ];

      const data = categoryRows.map((c) => [
        c.key,
        c.opening?.toFixed(2),
        c.inwards?.toFixed(2),
        c.outwards?.toFixed(2),
        c.transferIn?.toFixed(2),
        c.transferOut?.toFixed(2),
        (c.outwards - c.transferIn)?.toFixed(2),
        c.closing?.toFixed(2),
      ]);

      data.push([
        "Total",
        totals.opening?.toFixed(2),
        totals.inwards?.toFixed(2),
        totals.outwards?.toFixed(2),
        totals.transferIn?.toFixed(2),
        totals.transferOut?.toFixed(2),
        (totals.outwards - totals.transferIn)?.toFixed(2),
        totals.closing?.toFixed(2),
      ]);

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
          0: { cellWidth: 30, halign: "left" },
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
      });

      const fileName = `${selectedZoneName.replace(/ /g, "_")}_POS_Dashboard_${dayjs(dateRange.from).format("YYYYMMDD")}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // UI
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="mx-auto px-6 py-8 w-full md:w-[80%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">POS Dashboard</h2>
          <div className="relative">
            <button
              onClick={() => setExportDropdown(!exportDropdown)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
              disabled={skuRows.length === 0}
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
          <select
            value={selectedZone}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedZone(value);
              setSelectedZoneName(value === "all" ? "All Zones" : value);
            }}
            className="px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full md:w-48"
          >
            <option value="all">All Zones</option>
            {zones.map((z, index) => (
              <option key={index} value={z}>
                {z}
              </option>
            ))}
          </select>

          <SearchableSelect
            options={filteredCategories}
            selectedValue={selectedCategory}
            onChange={setSelectedCategory}
            placeholder="Select Category"
            disabled={categories.length === 0}
          />

          <SearchableSelect
            options={filteredBrands}
            selectedValue={selectedBrand}
            onChange={setSelectedBrand}
            placeholder="Select Brand"
            disabled={brands.length === 0}
          />

          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm">From:</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange({ ...dateRange, from: e.target.value })
                }
                className="border rounded px-4 py-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">To:</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange({ ...dateRange, to: e.target.value })
                }
                className="border rounded px-4 py-2"
              />
            </div>
            <button
              onClick={fetchData}
              className="bg-blue-900 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500">
            <p className="text-red-700">{String(error)}</p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
          {kpis.map((k) => (
            <KpiCard
              key={k.key}
              {...k}
              onClick={
                k.clickable
                  ? () => {
                      if (k.key === "primary")
                        openModal(
                          "Primary Sales",
                          filteredSkuRows.flatMap(
                            (item) => item.primaryStocks || [],
                          ),
                        );
                      if (k.key === "secondary")
                        openModal(
                          "Secondary Sales",
                          filteredSkuRows.flatMap(
                            (item) => item.secondarySales || [],
                          ),
                        );
                      if (k.key === "marketReturn")
                        openModal(
                          "Market Return",
                          filteredSkuRows.flatMap(
                            (item) => item.marketReturnTransfers || [],
                          ),
                        );
                      if (k.key === "officeReturn")
                        openModal(
                          "Office Return",
                          filteredSkuRows.flatMap(
                            (item) => item.officeReturnTransfers || [],
                          ),
                        );
                    }
                  : undefined
              }
            />
          ))}
        </div>

        {/* Inventory Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card
            title="Sales by Category"
            subtitle="Opening / Primary / Secondary / Market Return / Office Return / Actual Secondary / Closing"
            searchValue={categorySearch}
            onSearchChange={setCategorySearch}
          >
            <div className="h-96 overflow-y-scroll relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium text-gray-900">
                        Category
                      </th>
                      <th className="py-3 px-4 text-right font-medium text-gray-900">
                        Opening
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Primary
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Secondary
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Market Return
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Office Return
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Actual Secondary
                      </th>
                      <th className="py-3 px-4 text-right font-medium text-gray-900">
                        Closing
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {categoryRows.map((c) => (
                      <tr key={c.key} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-left">{c.key}</td>
                        <td className="py-3 px-4 text-right">
                          {fmt(c.opening?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(c.inwards?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(c.outwards?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(c.transferIn?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(c.transferOut?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt((c.outwards - c.transferIn)?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {fmt(c.closing?.toFixed(2))}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold bg-gray-50">
                      <td className="py-3 px-4 text-left">Total</td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.opening?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.inwards?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.outwards?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.transferIn?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.transferOut?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt((totals.outwards - totals.transferIn)?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.closing?.toFixed(2))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card
            title="Sales by Brand"
            subtitle="Opening / Primary / Secondary / Market Return / Office Return / Actual Secondary / Closing"
            searchValue={brandSearch}
            onSearchChange={setBrandSearch}
          >
            <div className="h-96 overflow-y-scroll relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium text-gray-900">
                        Brand
                      </th>
                      <th className="py-3 px-4 text-right font-medium text-gray-900">
                        Opening
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Primary
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Secondary
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Market Return
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Office Return
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Actual Secondary
                      </th>
                      <th className="py-3 px-4 text-right font-medium text-gray-900">
                        Closing
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {brandRows.map((b) => (
                      <tr key={b.key} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-left">{b.key}</td>
                        <td className="py-3 px-4 text-right">
                          {fmt(b.opening?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(b.inwards?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(b.outwards?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(b.transferIn?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(b.transferOut?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt((b.outwards - b.transferIn)?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {fmt(b.closing?.toFixed(2))}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold bg-gray-50">
                      <td className="py-3 px-4 text-left">Total</td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.opening?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.inwards?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.outwards?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.transferIn?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.transferOut?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt((totals.outwards - totals.transferIn)?.toFixed(2))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fmt(totals.closing?.toFixed(2))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* Movement blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card title="Top Sales SKUs" subtitle="By secondary sales">
            <div className="h-80 overflow-y-auto relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {topOutwards.map((m) => (
                    <li
                      key={m.barcode}
                      className="py-3 px-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {m.productName}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {fmt(m.secondary?.toFixed(2))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card title="Not Moving SKUs" subtitle="No Primary/Secondary">
            <div className="h-80 overflow-y-auto relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {notMoving.map((sku) => (
                    <li
                      key={sku.barcode}
                      className="py-3 px-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {sku.productName}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 ms-6">
                        no activity
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card title="Minimum Stock SKUs" subtitle="Lowest on-hand">
            <div className="h-80 overflow-y-auto relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {minStock.map((s) => (
                    <li
                      key={s.barcode}
                      className="py-3 px-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {s.productName}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {fmt(s.closingStock?.toFixed(2))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Overstock & Outwards vs Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card
            title="Overstock (Top 100 SKUs)"
            subtitle="Sorted by closing stock"
          >
            <div className="h-96 overflow-y-auto relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium text-gray-900">
                        Product
                      </th>
                      <th className="py-3 px-4 text-right font-medium text-gray-900">
                        On-hand
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {overStockTop100.map((o) => (
                      <tr key={o.barcode} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-left">{o.productName}</td>
                        <td className="py-3 px-4 text-right font-medium">
                          {fmt(o.closingStock?.toFixed(2))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card
            title="Actual Secondary vs Stock"
            subtitle={`Actual Secondary vs stock over ${periodDays} days`}
          >
            <div className="h-96 overflow-y-auto relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium text-gray-900">
                        Product
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        On-hand
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Actual Secondary (period)
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-900">
                        Stock/Actual Secondary
                      </th>
                      <th className="py-3 px-4 text-right font-medium text-gray-900">
                        Cover (days)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {outwardsVsStock.map((r) => (
                      <tr key={r.barcode} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-left">{r.productName}</td>
                        <td className="py-3 px-4 text-right">
                          {fmt(r.onhand?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fmt(r.outwards?.toFixed(2))}
                        </td>
                        <td className="py-3 px-4 text-right">{r.ratio}</td>
                        <td className="py-3 px-4 text-right font-medium">
                          {r.coverDays} d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">
                  {modalData.type} Details
                </h3>
                <div className="flex gap-2">
                  {modalData.details.length > 0 && (
                    <button
                      onClick={exportModalToExcel}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-1"
                    >
                      Export to Excel
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 overflow-auto flex-1">
                {modalData.details.length > 0 ? (
                  (() => {
                    const groupedDetails = modalData.details.reduce(
                      (acc, detail) => {
                        const key = getDetailKey(modalData.type, detail);
                        if (!acc[key]) {
                          acc[key] = {
                            name: key,
                            value: 0,
                            details: [],
                          };
                        }
                        acc[key].value += detail.quantity || 0;
                        acc[key].details.push(detail);
                        return acc;
                      },
                      {},
                    );

                    const sortedGroups = Object.values(groupedDetails).sort(
                      (a, b) => a.name.localeCompare(b.name),
                    );

                    return (
                      <div>
                        <table className="min-w-full divide-y divide-gray-200 mb-6">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="py-3 px-4 text-left font-medium text-gray-900">
                                {getGroupKey(modalData.type)}
                              </th>
                              <th className="py-3 px-4 text-right font-medium text-gray-900">
                                Quantity
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {sortedGroups.map((group) => (
                              <tr
                                key={group.name}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() =>
                                  openModal(
                                    `${modalData.type} - ${group.name}`,
                                    group.details,
                                  )
                                }
                              >
                                <td className="py-3 px-4 text-left">
                                  {group.name}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {group.value?.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {modalData.type.includes(" - ") && (
                          <div>
                            <h4 className="text-lg font-semibold mb-2 text-gray-900">
                              Transaction Details:
                            </h4>
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="py-3 px-4 text-left font-medium text-gray-900">
                                    Date
                                  </th>
                                  {(modalData.type.includes("Primary Sales") ||
                                    modalData.type.includes(
                                      "Secondary Sales",
                                    )) && (
                                    <th className="py-3 px-4 text-left font-medium text-gray-900">
                                      Invoice
                                    </th>
                                  )}
                                  {selectedZone === "all" && (
                                    <th className="py-3 px-4 text-left font-medium text-gray-900">
                                      Zone
                                    </th>
                                  )}
                                  <th className="py-3 px-4 text-right font-medium text-gray-900">
                                    Quantity
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {modalData.details.map((detail, index) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-left">
                                      {dayjs(detail.date).format("DD-MM-YYYY")}
                                    </td>
                                    {(modalData.type.includes(
                                      "Primary Sales",
                                    ) ||
                                      modalData.type.includes(
                                        "Secondary Sales",
                                      )) && (
                                      <td className="py-3 px-4 text-left">
                                        {detail.invoice}
                                      </td>
                                    )}
                                    {selectedZone === "all" && (
                                      <td className="py-3 px-4 text-left">
                                        {detail.outlet}
                                      </td>
                                    )}
                                    <td className="py-3 px-4 text-right">
                                      {detail.quantity?.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-gray-500">No details available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helpers
function groupByKey(rows, key, periodDays) {
  const map = {};
  for (const r of rows) {
    const k = r[key] || "Unknown";
    if (!map[k])
      map[k] = {
        key: k,
        opening: 0,
        inwards: 0,
        outwards: 0,
        transferIn: 0,
        transferOut: 0,
        closing: 0,
      };
    map[k].opening += r.openingStock;
    map[k].inwards += r.primary;
    map[k].outwards += r.secondary;
    map[k].transferIn += r.marketReturn;
    map[k].transferOut += r.officeReturn;
    map[k].closing +=
      r.openingStock +
      r.primary +
      r.marketReturn -
      r.officeReturn -
      r.secondary;
  }
  return Object.values(map).sort((a, b) => b.closing - a.closing);
}

function sumRows(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.opening += r.opening;
      acc.inwards += r.inwards;
      acc.outwards += r.outwards;
      acc.transferIn += r.transferIn;
      acc.transferOut += r.transferOut;
      acc.closing += r.closing;
      return acc;
    },
    {
      opening: 0,
      inwards: 0,
      outwards: 0,
      transferIn: 0,
      transferOut: 0,
      closing: 0,
    },
  );
}

function outwardsStockRow(r, days) {
  const onhand = num(r.closingStock);
  const outwards = num(r.secondary) - num(r.marketReturn);
  const daily = outwards > 0 && days > 0 ? outwards / days : 0;
  const coverDays = daily > 0 ? Math.round(onhand / daily) : Infinity;
  return {
    barcode: r.barcode,
    productName: r.productName,
    onhand,
    outwards,
    ratio: outwards > 0 ? (onhand / outwards).toFixed(1) + "x" : "∞",
    coverDays: isFinite(coverDays) ? coverDays : 9999,
  };
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromYMD, toYMD) {
  const from = new Date(fromYMD + "T00:00:00");
  const to = new Date(toYMD + "T23:59:59");
  const ms = Math.max(1, to.getTime() - from.getTime());
  return Math.ceil(ms / (24 * 3600 * 1000));
}

// UI Primitives
function Card({
  title,
  subtitle,
  className = "",
  children,
  searchValue,
  onSearchChange,
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md border border-gray-200 ${className}`}
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {onSearchChange && (
            <div className="relative w-48">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={`Search ${title.split(" by ")[1] || "items"}...`}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          )}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone, text, onClick }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-gradient-to-br ${tone} p-4 shadow-md ${onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 text-center">{label}</p>
          <p className={`mt-1 text-2xl font-bold tracking-tight ${text}`}>
            {typeof value === "number" ? fmt(value?.toFixed(2)) : value}
          </p>
        </div>
        <div className={`p-2 rounded-xl ${text.replace("text-", "bg-")}/10`}>
          <Icon className={`h-5 w-5 ${text}`} />
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full ${text.replace("text-", "bg-")}`}
          style={{ width: "60%" }}
        />
      </div>
    </div>
  );
}
