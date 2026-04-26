import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";

const GroupStockMovementReport = () => {
  const user = JSON.parse(localStorage.getItem("pos-user"));
  const [selectedType, setSelectedType] = useState("ASM");
  const [selectedArea, setSelectedArea] = useState("");
  const [areaOptions, setAreaOptions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [exportDropdown, setExportDropdown] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: dayjs().startOf("month").format("YYYY-MM-DD"),
    end: dayjs().endOf("month").format("YYYY-MM-DD"),
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalContext, setModalContext] = useState("");
  const [transactionData, setTransactionData] = useState({});
  const [currentBarcode, setCurrentBarcode] = useState(null);
  const [selectedOutlet, setSelectedOutlet] = useState("");

  useEffect(() => {
    const fetchAreaOptions = async () => {
      try {
        let endpoint = "";
        let params = {};

        if (selectedType === "Chain") {
          endpoint = "http://175.29.181.245:15001/api/chain-options";
        } else {
          endpoint = "http://175.29.181.245:15001/api/area-options";
          params = { type: selectedType };
        }

        const response = await axios.get(endpoint, { params });
        if (response.data?.success) {
          const options = response.data.data || [];
          setAreaOptions(options);
          if (options.length > 0) {
            setSelectedArea(options[0]);
          } else {
            setSelectedArea("");
          }
        }
      } catch (error) {
        console.error("Error fetching area/chain options:", error);
        setAreaOptions([]);
        setSelectedArea("");
      }
    };

    fetchAreaOptions();
  }, [selectedType]);

  useEffect(() => {
    if (selectedArea && dateRange.start && dateRange.end) {
      fetchReportData();
    }
  }, [selectedArea, dateRange.start, dateRange.end]);

  useEffect(() => {
    setTransactionData({});
  }, [selectedType, selectedArea, dateRange.start, dateRange.end]);

  useEffect(() => {
    if (
      modalType &&
      selectedType &&
      selectedArea &&
      dateRange.start &&
      dateRange.end
    ) {
      const context = modalContext;
      const barcode = context === "product" ? currentBarcode : null;
      fetchDetails(modalType.toLowerCase(), barcode, context);
    }
  }, [selectedType, selectedArea, dateRange.start, dateRange.end]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!dateRange.start || !dateRange.end) {
        throw new Error("Please select both start and end dates");
      }

      const params = {
        areaType: selectedType,
        areaValue: selectedArea,
        startDate: dayjs(dateRange.start).format("YYYY-MM-DD HH:mm:ss"),
        endDate: dayjs(dateRange.end)
          .endOf("day")
          .format("YYYY-MM-DD HH:mm:ss"),
      };

      const endpoint =
        selectedType === "Chain"
          ? "http://175.29.181.245:15001/api/chain-stock-movement"
          : "http://175.29.181.245:15001/api/area-stock-movement";

      const response = await axios.get(endpoint, { params });

      if (response.data?.success) {
        const filteredData = response.data.data.filter((item) => {
          return (
            (item.openingStock && item.openingStock !== 0) ||
            (item.primary && item.primary !== 0) ||
            (item.secondary && item.secondary !== 0) ||
            (item.officeReturn && item.officeReturn !== 0) ||
            (item.marketReturn && item.marketReturn !== 0) ||
            (item.transferIn && item.transferIn !== 0) ||
            (item.transferOut && item.transferOut !== 0)
          );
        });

        const uniqueCategories = [
          ...new Set(
            filteredData.map((item) => item.category || "Uncategorized"),
          ),
        ].sort();
        setCategories([
          { value: "all", label: "All Categories" },
          ...uniqueCategories.map((c) => ({ value: c, label: c })),
        ]);

        const uniqueBrands = [
          ...new Set(filteredData.map((item) => item.brand || "Unbranded")),
        ].sort();
        setBrands([
          { value: "all", label: "All Brands" },
          ...uniqueBrands.map((b) => ({ value: b, label: b })),
        ]);

        const sortedData = [...filteredData].sort((a, b) =>
          a.productName.localeCompare(b.productName),
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
      } else if (error.request) {
        errorMessage = "No response from server";
      }
      setError(errorMessage);
      setReportData([]);
      setCategories([]);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (selectedBrand === "all") {
      return categories;
    }
    const relevantCats = [
      ...new Set(
        reportData
          .filter((item) => item.brand === selectedBrand)
          .map((item) => item.category || "Uncategorized"),
      ),
    ].sort();
    return [
      { value: "all", label: "All Categories" },
      ...relevantCats.map((c) => ({ value: c, label: c })),
    ];
  }, [selectedBrand, categories, reportData]);

  const filteredBrands = useMemo(() => {
    if (selectedCategory === "all") {
      return brands;
    }
    const relevantBrands = [
      ...new Set(
        reportData
          .filter((item) => item.category === selectedCategory)
          .map((item) => item.brand || "Unbranded"),
      ),
    ].sort();
    return [
      { value: "all", label: "All Brands" },
      ...relevantBrands.map((b) => ({ value: b, label: b })),
    ];
  }, [selectedCategory, brands, reportData]);

  useEffect(() => {
    const catValues = filteredCategories.map((o) => o.value);
    if (selectedCategory !== "all" && !catValues.includes(selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [filteredCategories]);

  useEffect(() => {
    const brandValues = filteredBrands.map((o) => o.value);
    if (selectedBrand !== "all" && !brandValues.includes(selectedBrand)) {
      setSelectedBrand("all");
    }
  }, [filteredBrands]);

  const fetchDetails = async (
    type,
    productBarcode = null,
    context = "total",
  ) => {
    setLoadingDetails(true);
    setModalData(null);
    setModalType(
      type
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    );
    setModalContext(productBarcode ? "product" : context);
    setSelectedOutlet("");
    if (productBarcode) {
      setCurrentBarcode(productBarcode);
    }

    let data;
    if (transactionData[type]) {
      data = transactionData[type];
    } else {
      try {
        const params = {
          // For Chain: use 'areaValue' instead of 'areaType'
          ...(selectedType === "Chain"
            ? { areaValue: selectedArea }
            : { areaType: selectedType, areaValue: selectedArea }),
          startDate: dayjs(dateRange.start).format("YYYY-MM-DD HH:mm:ss"),
          endDate: dayjs(dateRange.end)
            .endOf("day")
            .format("YYYY-MM-DD HH:mm:ss"),
          type: type,
        };

        const endpoint =
          selectedType === "Chain"
            ? "http://175.29.181.245:15001/api/chain-stock-transactions"
            : "http://175.29.181.245:15001/api/area-stock-transactions";

        const response = await axios.get(endpoint, { params });

        if (response.data.success) {
          data = response.data.data;
          setTransactionData((prev) => ({ ...prev, [type]: data }));
        } else {
          setError("Failed to load transaction details");
          setLoadingDetails(false);
          return;
        }
      } catch (err) {
        console.error("Details fetch error:", err);
        setError("Failed to load transaction details");
        setLoadingDetails(false);
        return;
      }
    }

    if (productBarcode) {
      const filtered = {};
      Object.keys(data).forEach((date) => {
        if (date !== "products") {
          const trans = data[date].filter((t) => t.barcode == productBarcode);
          if (trans.length > 0) {
            filtered[date] = trans;
          }
        }
      });

      const allTrans = Object.values(filtered).flat();
      if (allTrans.length > 0) {
        const first = allTrans[0];
        filtered.products = [
          {
            productName: first.productName,
            barcode: first.barcode,
            tpPrice: first.tpPrice,
          },
        ];
      }

      setModalData(filtered);
    } else {
      setModalData(data);
    }

    setLoadingDetails(false);
  };

  const handleFilterClick = () => {
    fetchReportData();
  };

  const exportToExcel = () => {
    const filteredData = reportData.filter(
      (item) =>
        (selectedCategory === "all" || item.category === selectedCategory) &&
        (selectedBrand === "all" || item.brand === selectedBrand),
    );
    const sortedData = [...filteredData].sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );

    const excelData = [
      [
        `${selectedType}: ${selectedArea}`,
        "",
        "",
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
      ["", "", "", "", "", "", "", "", "", "", "", ""],
      [
        "Sl",
        "Products Name",
        "Category",
        "Brand",
        "Opening Stock",
        "",
        "Primary",
        "",
        "Market Return",
        "",
        "Transfer In",
        "",
        "Office Return",
        "",
        "Transfer Out",
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
        "",
        "",
        "Qty",
        "Value",
        "Qty",
        "Value",
        "Qty",
        "Value",
        "Qty",
        "Value",
        "Qty",
        "Value",
        "Qty",
        "Value",
        "Qty",
        "Value",
        "Qty",
        "Value",
        "Qty",
        "Value",
      ],
      ...sortedData.map((item, index) => [
        index + 1,
        item.productName,
        item.category,
        item.brand,
        item.openingStock,
        item.openingValueTP?.toFixed(2),
        item.primary,
        item.primaryValueTP?.toFixed(2),
        item.marketReturn,
        item.marketReturnValueTP?.toFixed(2),
        item.transferIn,
        item.transferInValueTP?.toFixed(2),
        item.officeReturn,
        item.officeReturnValueTP?.toFixed(2),
        item.transferOut,
        item.transferOutValueTP?.toFixed(2),
        item.secondary,
        item.secondaryValueTP?.toFixed(2),
        item.secondary - item.marketReturn,
        (item.secondaryValueTP - item.marketReturnValueTP)?.toFixed(2),
        item.openingStock +
          item.primary +
          item.marketReturn +
          item.transferIn -
          item.secondary -
          item.officeReturn -
          item.transferOut,
        (
          item.openingValueTP +
          item.primaryValueTP +
          item.marketReturnValueTP +
          item.transferInValueTP -
          item.secondaryValueTP -
          item.officeReturnValueTP -
          item.transferOutValueTP
        )?.toFixed(2),
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 0, c: 11 }, e: { r: 0, c: 21 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 1, c: 11 }, e: { r: 1, c: 21 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
      { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } },
      { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } },
      { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
      { s: { r: 2, c: 12 }, e: { r: 2, c: 13 } },
      { s: { r: 2, c: 14 }, e: { r: 2, c: 15 } },
      { s: { r: 2, c: 16 }, e: { r: 2, c: 17 } },
      { s: { r: 2, c: 18 }, e: { r: 2, c: 19 } },
      { s: { r: 2, c: 20 }, e: { r: 2, c: 21 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Stock Movement");
    XLSX.writeFile(
      wb,
      `Stock_Movement_${selectedType}_${selectedArea}_${dateRange.start}.xlsx`,
    );
  };

  const exportToPDF = () => {
    const filteredData = reportData.filter(
      (item) =>
        (selectedCategory === "all" || item.category === selectedCategory) &&
        (selectedBrand === "all" || item.brand === selectedBrand),
    );
    const sortedData = [...filteredData].sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
      });

      doc.setFontSize(12);
      doc.text(`${selectedType}: ${selectedArea || ""}`, 14, 15);
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
          "Products Name",
          "Category",
          "Brand",
          "Opening Stock",
          "",
          "Primary",
          "",
          "Market Return",
          "",
          "Transfer In",
          "",
          "Office Return",
          "",
          "Transfer Out",
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
          "",
          "",
          "Qty",
          "Value",
          "Qty",
          "Value",
          "Qty",
          "Value",
          "Qty",
          "Value",
          "Qty",
          "Value",
          "Qty",
          "Value",
          "Qty",
          "Value",
          "Qty",
          "Value",
          "Qty",
          "Value",
        ],
      ];

      const data = sortedData.map((item, index) => [
        index + 1,
        item.productName || "",
        item.category || "",
        item.brand || "",
        item.openingStock || 0,
        item.openingValueTP?.toFixed(2) || "0.00",
        item.primary || 0,
        item.primaryValueTP?.toFixed(2) || "0.00",
        item.marketReturn || 0,
        item.marketReturnValueTP?.toFixed(2) || "0.00",
        item.transferIn || 0,
        item.transferInValueTP?.toFixed(2) || "0.00",
        item.officeReturn || 0,
        item.officeReturnValueTP?.toFixed(2) || "0.00",
        item.transferOut || 0,
        item.transferOutValueTP?.toFixed(2) || "0.00",
        item.secondary || 0,
        item.secondaryValueTP?.toFixed(2) || "0.00",
        item.secondary - item.marketReturn || 0,
        (item.secondaryValueTP - item.marketReturnValueTP)?.toFixed(2) ||
          "0.00",
        item.openingStock +
          item.primary +
          item.marketReturn +
          item.transferIn -
          item.secondary -
          item.officeReturn -
          item.transferOut || 0,
        (
          item.openingValueTP +
          item.primaryValueTP +
          item.marketReturnValueTP +
          item.transferInValueTP -
          item.secondaryValueTP -
          item.officeReturnValueTP -
          item.transferOutValueTP
        )?.toFixed(2) || "0.00",
      ]);

      const totals = calculateTotals(sortedData);
      data.push([
        "",
        "TOTAL",
        "",
        "",
        totals.openingQty || 0,
        totals.openingValue?.toFixed(2) || "0.00",
        totals.primaryQty || 0,
        totals.primaryValue?.toFixed(2) || "0.00",
        totals.marketReturnQty || 0,
        totals.marketReturnValue?.toFixed(2) || "0.00",
        totals.transferInQty || 0,
        totals.transferInValue?.toFixed(2) || "0.00",
        totals.officeReturnQty || 0,
        totals.officeReturnValue?.toFixed(2) || "0.00",
        totals.transferOutQty || 0,
        totals.transferOutValue?.toFixed(2) || "0.00",
        totals.secondaryQty || 0,
        totals.secondaryValue?.toFixed(2) || "0.00",
        totals.actualSecondaryQty || 0,
        totals.actualSecondaryValue?.toFixed(2) || "0.00",
        totals.closingQty || 0,
        totals.closingValue?.toFixed(2) || "0.00",
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
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 30, halign: "left" },
          2: { cellWidth: 20, halign: "left" },
          3: { cellWidth: 20, halign: "left" },
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        didParseCell: function (data) {
          if (data.section === "head" && data.row.index === 0) {
            if (
              data.column.dataKey === 4 ||
              data.column.dataKey === 6 ||
              data.column.dataKey === 8 ||
              data.column.dataKey === 10 ||
              data.column.dataKey === 12 ||
              data.column.dataKey === 14 ||
              data.column.dataKey === 16 ||
              data.column.dataKey === 18 ||
              data.column.dataKey === 20
            ) {
              data.cell.colSpan = 2;
            }
          }
        },
      });

      const fileName = `Stock_Report_${selectedType}_${selectedArea || "all"}_${
        dayjs(dateRange.start).format("YYYY-MM-DD") +
        "_to_" +
        dayjs(dateRange.end).format("YYYY-MM-DD")
      }_${dayjs().format("YYYYMMDD")}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const calculateTotals = (data) => {
    return data.reduce(
      (acc, item) => {
        acc.openingQty += item.openingStock || 0;
        acc.openingValue += item.openingValueTP || 0;
        acc.primaryQty += item.primary || 0;
        acc.primaryValue += item.primaryValueTP || 0;
        acc.marketReturnQty += item.marketReturn || 0;
        acc.marketReturnValue += item.marketReturnValueTP || 0;
        acc.transferInQty += item.transferIn || 0;
        acc.transferInValue += item.transferInValueTP || 0;
        acc.officeReturnQty += item.officeReturn || 0;
        acc.officeReturnValue += item.officeReturnValueTP || 0;
        acc.transferOutQty += item.transferOut || 0;
        acc.transferOutValue += item.transferOutValueTP || 0;
        acc.secondaryQty += item.secondary || 0;
        acc.secondaryValue += item.secondaryValueTP || 0;
        acc.actualSecondaryQty += item.secondary - item.marketReturn || 0;
        acc.actualSecondaryValue +=
          item.secondaryValueTP - item.marketReturnValueTP || 0;
        acc.closingQty +=
          item.openingStock +
            item.primary +
            item.marketReturn +
            item.transferIn -
            item.secondary -
            item.officeReturn -
            item.transferOut || 0;
        acc.closingValue +=
          item.openingValueTP +
            item.primaryValueTP +
            item.marketReturnValueTP +
            item.transferInValueTP -
            item.secondaryValueTP -
            item.officeReturnValueTP -
            item.transferOutValueTP || 0;
        return acc;
      },
      {
        openingQty: 0,
        openingValue: 0,
        primaryQty: 0,
        primaryValue: 0,
        marketReturnQty: 0,
        marketReturnValue: 0,
        transferInQty: 0,
        transferInValue: 0,
        officeReturnQty: 0,
        officeReturnValue: 0,
        transferOutQty: 0,
        transferOutValue: 0,
        secondaryQty: 0,
        secondaryValue: 0,
        actualSecondaryQty: 0,
        actualSecondaryValue: 0,
        closingQty: 0,
        closingValue: 0,
      },
    );
  };

  const totals = calculateTotals(
    reportData.filter(
      (item) =>
        (selectedCategory === "all" || item.category === selectedCategory) &&
        (selectedBrand === "all" || item.brand === selectedBrand),
    ),
  );

  const getModalTitle = () => {
    let title = `${modalType} Transaction Details`;

    if (modalContext === "summary") {
      return `Summary - ${title}`;
    } else if (modalContext === "product") {
      const productName =
        modalData && modalData.products && modalData.products[0]?.productName;
      return `${productName || "Product"} - ${title}`;
    } else {
      return `Total - ${title}`;
    }
  };

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
            Tali
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

  const filteredData = reportData.filter(
    (item) =>
      (selectedCategory === "all" || item.category === selectedCategory) &&
      (selectedBrand === "all" || item.brand === selectedBrand),
  );

  return (
    <div className="flex">
      <AdminSidebar />

      <div className="mx-auto px-6 py-8 w-full md:w-[80%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            Group Stock Movement Report
          </h2>
          <div className="relative">
            <button
              onClick={() => setExportDropdown(!exportDropdown)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
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
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border rounded-md shadow-sm w-full md:w-48"
          >
            <option value="ASM">ASM Wise</option>
            <option value="SOM">SOM Wise</option>
            <option value="Zone">Zone Wise</option>
            <option value="Chain">Chain Wise</option>
          </select>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="px-4 py-2 border rounded-md shadow-sm w-full md:w-48"
            disabled={areaOptions.length === 0}
          >
            {areaOptions.length > 0 ? (
              areaOptions.map((area, index) => (
                <option key={index} value={area}>
                  {area?.toUpperCase()}
                </option>
              ))
            ) : (
              <option value="">Loading...</option>
            )}
          </select>

          <SearchableSelect
            options={filteredCategories}
            selectedValue={selectedCategory}
            onChange={setSelectedCategory}
            placeholder="Select Category"
            disabled={filteredCategories.length === 0}
          />
          <SearchableSelect
            options={filteredBrands}
            selectedValue={selectedBrand}
            onChange={setSelectedBrand}
            placeholder="Select Brand"
            disabled={filteredBrands.length === 0}
          />
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

        {!loading && filteredData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-9 gap-4 mb-6">
            <div className="bg-white border-l-4 border-purple-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Opening Stock (TP)</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-semibold text-purple-700">
                  {totals.openingValue?.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="bg-white border-l-4 border-green-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Primary Stock (TP)</p>
              <div className="flex items-center justify-between">
                <p
                  className="text-2xl font-semibold text-green-700 cursor-pointer hover:underline"
                  onClick={() => fetchDetails("primary", null, "summary")}
                >
                  {totals.primaryValue?.toFixed(2)}
                </p>
                <button
                  onClick={() => fetchDetails("primary", null, "summary")}
                  className="text-xs text-green-600 hover:text-green-800 ml-2"
                  title="View Details"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-white border-l-4 border-red-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Market Returns (TP)</p>
              <div className="flex items-center justify-between">
                <p
                  className="text-2xl font-semibold text-red-700 cursor-pointer hover:underline"
                  onClick={() => fetchDetails("market return", null, "summary")}
                >
                  {totals.marketReturnValue?.toFixed(2)}
                </p>
                <button
                  onClick={() => fetchDetails("market return", null, "summary")}
                  className="text-xs text-red-600 hover:text-red-800 ml-2"
                  title="View Details"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-white border-l-4 border-cyan-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Transfer In (TP)</p>
              <div className="flex items-center justify-between">
                <p
                  className="text-2xl font-semibold text-cyan-700 cursor-pointer hover:underline"
                  onClick={() => fetchDetails("transfer in", null, "summary")}
                >
                  {totals.transferInValue?.toFixed(2)}
                </p>
                <button
                  onClick={() => fetchDetails("transfer in", null, "summary")}
                  className="text-xs text-cyan-600 hover:text-cyan-800 ml-2"
                  title="View Details"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-white border-l-4 border-yellow-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Office Returns (TP)</p>
              <div className="flex items-center justify-between">
                <p
                  className="text-2xl font-semibold text-yellow-700 cursor-pointer hover:underline"
                  onClick={() => fetchDetails("office return", null, "summary")}
                >
                  {totals.officeReturnValue?.toFixed(2)}
                </p>
                <button
                  onClick={() => fetchDetails("office return", null, "summary")}
                  className="text-xs text-yellow-600 hover:text-yellow-800 ml-2"
                  title="View Details"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-white border-l-4 border-orange-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Transfer Out (TP)</p>
              <div className="flex items-center justify-between">
                <p
                  className="text-2xl font-semibold text-orange-700 cursor-pointer hover:underline"
                  onClick={() => fetchDetails("transfer out", null, "summary")}
                >
                  {totals.transferOutValue?.toFixed(2)}
                </p>
                <button
                  onClick={() => fetchDetails("transfer out", null, "summary")}
                  className="text-xs text-orange-600 hover:text-orange-800 ml-2"
                  title="View Details"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-white border-l-4 border-blue-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Secondary Sales (TP)</p>
              <div className="flex items-center justify-between">
                <p
                  className="text-2xl font-semibold text-blue-700 cursor-pointer hover:underline"
                  onClick={() => fetchDetails("secondary", null, "summary")}
                >
                  {totals.secondaryValue?.toFixed(2)}
                </p>
                <button
                  onClick={() => fetchDetails("secondary", null, "summary")}
                  className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                  title="View Details"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-white border-l-4 border-teal-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Actual Secondary (TP)</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-semibold text-teal-700">
                  {totals.actualSecondaryValue?.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="bg-white border-l-4 border-indigo-600 p-4 rounded shadow">
              <p className="text-sm text-gray-600">Closing Stock (TP)</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-semibold text-indigo-700">
                  {totals.closingValue?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && filteredData.length > 0 && (
          <div
            className="overflow-x-auto shadow rounded-lg"
            style={{ maxHeight: "95vh" }}
          >
            <table className="min-w-full border">
              <thead className="sticky top-[-1px] bg-white z-10">
                <tr>
                  <th colSpan="22" className="bg-gray-200 px-4 py-2 text-left">
                    {selectedType}: {selectedArea}
                  </th>
                </tr>
                <tr>
                  <th colSpan="22" className="bg-gray-200 px-4 py-3 text-left">
                    Period: {dayjs(dateRange.start).format("DD-MM-YY")} to{" "}
                    {dayjs(dateRange.end).format("DD-MM-YY")}
                    {selectedCategory !== "all" &&
                      ` | Category: ${selectedCategory}`}
                    {selectedBrand !== "all" && ` | Brand: ${selectedBrand}`}
                  </th>
                </tr>
                <tr className="bg-gray-100">
                  <th rowSpan="2" className="p-2 sticky top-22 bg-gray-100">
                    Sl
                  </th>
                  <th rowSpan="2" className="p-2 sticky top-22 bg-gray-100">
                    Products Name
                  </th>
                  <th rowSpan="2" className="p-2 sticky top-22 bg-gray-100">
                    Category
                  </th>
                  <th rowSpan="2" className="p-2 sticky top-22 bg-gray-100">
                    Brand
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
                    Transfer In
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
                    Transfer Out
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
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                  <th className="border p-2">Qty</th>
                  <th className="border p-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => (
                  <tr key={item.barcode} className="hover:bg-gray-50">
                    <td className="border p-2">{index + 1}</td>
                    <td className="border p-2">{item.productName}</td>
                    <td className="border p-2">{item.category}</td>
                    <td className="border p-2">{item.brand}</td>
                    <td className="border p-2 text-right">
                      {item.openingStock} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.openingValueTP?.toFixed(2)}
                    </td>
                    <td
                      className="border p-2 text-right cursor-pointer text-green-600 hover:underline"
                      onClick={() =>
                        fetchDetails("primary", item.barcode, "product")
                      }
                    >
                      {item.primary} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.primaryValueTP?.toFixed(2)}
                    </td>
                    <td
                      className="border p-2 text-right cursor-pointer text-red-600 hover:underline"
                      onClick={() =>
                        fetchDetails("market return", item.barcode, "product")
                      }
                    >
                      {item.marketReturn} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.marketReturnValueTP?.toFixed(2)}
                    </td>
                    <td
                      className="border p-2 text-right cursor-pointer text-cyan-600 hover:underline"
                      onClick={() =>
                        fetchDetails("transfer in", item.barcode, "product")
                      }
                    >
                      {item.transferIn} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.transferInValueTP?.toFixed(2)}
                    </td>
                    <td
                      className="border p-2 text-right cursor-pointer text-yellow-600 hover:underline"
                      onClick={() =>
                        fetchDetails("office return", item.barcode, "product")
                      }
                    >
                      {item.officeReturn} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.officeReturnValueTP?.toFixed(2)}
                    </td>
                    <td
                      className="border p-2 text-right cursor-pointer text-orange-600 hover:underline"
                      onClick={() =>
                        fetchDetails("transfer out", item.barcode, "product")
                      }
                    >
                      {item.transferOut} pcs
                    </td>
                    <td className="border p-2 text-right">
                      {item.transferOutValueTP?.toFixed(2)}
                    </td>
                    <td
                      className="border p-2 text-right cursor-pointer text-blue-600 hover:underline"
                      onClick={() =>
                        fetchDetails("secondary", item.barcode, "product")
                      }
                    >
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
                        item.marketReturn +
                        item.transferIn -
                        item.secondary -
                        item.officeReturn -
                        item.transferOut}{" "}
                      pcs
                    </td>
                    <td className="border p-2 text-right">
                      {(
                        item.openingValueTP +
                        item.primaryValueTP +
                        item.marketReturnValueTP +
                        item.transferInValueTP -
                        item.secondaryValueTP -
                        item.officeReturnValueTP -
                        item.transferOutValueTP
                      )?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-[-1px] bg-gray-100">
                <tr className="font-bold">
                  <td className="p-2" colSpan="4">
                    Total
                  </td>
                  <td className="p-2 text-right">{totals.openingQty}</td>
                  <td className="p-2 text-right">
                    {totals.openingValue.toFixed(2)}
                  </td>
                  <td
                    className="p-2 text-right cursor-pointer text-green-600 hover:underline"
                    onClick={() => fetchDetails("primary", null, "total")}
                  >
                    {totals.primaryQty}
                  </td>
                  <td className="p-2 text-right">
                    {totals.primaryValue.toFixed(2)}
                  </td>
                  <td
                    className="p-2 text-right cursor-pointer text-red-600 hover:underline"
                    onClick={() => fetchDetails("market return", null, "total")}
                  >
                    {totals.marketReturnQty}
                  </td>
                  <td className="p-2 text-right">
                    {totals.marketReturnValue.toFixed(2)}
                  </td>
                  <td
                    className="p-2 text-right cursor-pointer text-cyan-600 hover:underline"
                    onClick={() => fetchDetails("transfer in", null, "total")}
                  >
                    {totals.transferInQty}
                  </td>
                  <td className="p-2 text-right">
                    {totals.transferInValue.toFixed(2)}
                  </td>
                  <td
                    className="p-2 text-right cursor-pointer text-yellow-600 hover:underline"
                    onClick={() => fetchDetails("office return", null, "total")}
                  >
                    {totals.officeReturnQty}
                  </td>
                  <td className="p-2 text-right">
                    {totals.officeReturnValue.toFixed(2)}
                  </td>
                  <td
                    className="p-2 text-right cursor-pointer text-orange-600 hover:underline"
                    onClick={() => fetchDetails("transfer out", null, "total")}
                  >
                    {totals.transferOutQty}
                  </td>
                  <td className="p-2 text-right">
                    {totals.transferOutValue.toFixed(2)}
                  </td>
                  <td
                    className="p-2 text-right cursor-pointer text-blue-600 hover:underline"
                    onClick={() => fetchDetails("secondary", null, "total")}
                  >
                    {totals.secondaryQty}
                  </td>
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

        {!loading && filteredData.length === 0 && reportData.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            No data available for selected filters
          </div>
        )}

        {!loading && reportData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No data available for selected period
          </div>
        )}

        {modalType && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold">{getModalTitle()}</h3>
                    <p className="text-blue-100 mt-1">
                      {selectedType}: {selectedArea} |{" "}
                      {dayjs(dateRange.start).format("DD-MM-YYYY")} to{" "}
                      {dayjs(dateRange.end).format("DD-MM-YYYY")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setModalType(null);
                      setModalData(null);
                      setModalContext("");
                      setSelectedOutlet("");
                    }}
                    className="text-white hover:text-gray-200 p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                    title="Close"
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
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {loadingDetails ? (
                  <div className="flex justify-center py-8">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                      <p className="mt-4 text-gray-600">
                        Loading transaction details...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {modalContext === "product" && modalData?.products && (
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold mb-3 text-gray-800">
                          Product: {modalData.products[0]?.productName}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">Barcode</p>
                            <p className="font-medium">
                              {modalData.products[0]?.barcode}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">TP Price</p>
                            <p className="font-medium">
                              {modalData.products[0]?.tpPrice?.toFixed(2) ||
                                "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {modalData &&
                      Object.keys(modalData)
                        .filter((key) => key !== "products")
                        .sort()
                        .map((date) => {
                          const transactions = modalData[date];
                          const filteredTransactions = selectedOutlet
                            ? transactions.filter(
                                (t) => t.outlet === selectedOutlet,
                              )
                            : transactions;

                          if (filteredTransactions.length === 0) return null;

                          const dateTotalQty = filteredTransactions.reduce(
                            (sum, t) => sum + t.quantity,
                            0,
                          );
                          const dateTotalValue = filteredTransactions.reduce(
                            (sum, t) => sum + t.valueTP,
                            0,
                          );

                          return (
                            <div
                              key={date}
                              className="mb-8 border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                            >
                              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-lg font-semibold text-gray-800">
                                    {dayjs(date).format("dddd, DD MMMM YYYY")}
                                  </h4>
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600">
                                      Total Qty: {dateTotalQty}
                                    </p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {dateTotalValue?.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="min-w-full">
                                  <thead className="bg-white">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Outlet
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Product
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Quantity
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        TP Value
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredTransactions.map((trans, idx) => (
                                      <tr
                                        key={idx}
                                        className="hover:bg-gray-50"
                                      >
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                          {trans.outlet}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                                          {trans.productName}
                                          {modalContext === "product" && (
                                            <span className="block text-xs text-gray-500">
                                              {trans.barcode}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                          {trans.quantity}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                          {trans.valueTP?.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">
                                    Total for {dayjs(date).format("DD-MM-YYYY")}
                                  </span>
                                  <div className="text-right">
                                    <span className="text-sm text-gray-600">
                                      Qty: {dateTotalQty}
                                    </span>
                                    <span className="ml-2 text-sm font-bold text-gray-900">
                                      {dateTotalValue?.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                  </>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {modalContext === "total" && (
                      <>
                        Showing all {modalType.toLowerCase()} transactions
                        across all products
                      </>
                    )}
                    {modalContext === "product" && (
                      <>
                        Showing {modalType.toLowerCase()} transactions for
                        specific product only
                      </>
                    )}
                    {selectedOutlet && (
                      <span> (Filtered by {selectedOutlet})</span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setModalType(null);
                        setModalData(null);
                        setModalContext("");
                        setSelectedOutlet("");
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Close
                    </button>
                    {modalData && Object.keys(modalData).length > 0 && (
                      <button
                        onClick={() => {
                          const exportData = Object.keys(modalData)
                            .map((date) => {
                              const transactions = modalData[date];
                              return transactions.map((t) => [
                                dayjs(date).format("DD-MM-YYYY"),
                                dayjs(t.date).format("HH:mm:ss"),
                                t.outlet,
                                t.productName,
                                t.quantity,
                                t.valueTP?.toFixed(2),
                              ]);
                            })
                            .flat();

                          const wb = XLSX.utils.book_new();
                          const ws = XLSX.utils.aoa_to_sheet([
                            [
                              "Date",
                              "Time",
                              "Outlet",
                              "Product",
                              "Quantity",
                              "TP Value",
                            ],
                            ...exportData,
                          ]);
                          XLSX.utils.book_append_sheet(
                            wb,
                            ws,
                            `${modalType} Details`,
                          );
                          XLSX.writeFile(
                            wb,
                            `${modalType}_${selectedType}_${selectedArea}_${dateRange.start}.xlsx`,
                          );
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Export to Excel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupStockMovementReport;
