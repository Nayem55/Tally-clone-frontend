import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";
import { FaSave, FaTrash, FaFileDownload, FaFileImport } from "react-icons/fa";
import * as XLSX from "xlsx";
import { ChevronDown, ChevronUp } from "lucide-react";

// Configure dayjs to handle date formats consistently
dayjs.locale("en");

export default function PromotionalPage() {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedPromotions, setSelectedPromotions] = useState({});
  const [expandedPromos, setExpandedPromos] = useState({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    const delay = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(delay);
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [debouncedSearch, currentPage]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let productsData = [];
      let allProductsData = [];

      if (debouncedSearch.trim()) {
        const response = await axios.get(
          `http://175.29.181.245:15001/search-product?search=${debouncedSearch}`,
        );
        productsData = response.data;
        setTotalPages(1);
      } else {
        const res = await axios.get(
          `http://175.29.181.245:15001/products?page=${currentPage}`,
        );
        const res2 = await axios.get(
          `http://175.29.181.245:15001/all-products`,
        );
        productsData = res.data.products;
        allProductsData = res2.data;
        setTotalPages(res.data.totalPages);
      }

      setProducts(productsData);
      setAllProducts(allProductsData);

      const initialPromotions = {};
      const initialExpanded = {};
      productsData.forEach((product) => {
        initialExpanded[product._id] = false;

        let baseType = product.promoType || "quantity";
        let basePaid = 0;
        let baseFree = 0;
        let basePercentage = product.promoPercentage || 0;

        if (
          baseType === "quantity" &&
          product.promoPlan &&
          product.promoPlan !== "None"
        ) {
          const [p, f] = product.promoPlan.split("+").map(Number);
          basePaid = p;
          baseFree = f;
        }

        initialPromotions[product._id] = {
          base: {
            type: baseType,
            paid: basePaid,
            free: baseFree,
            percentage: basePercentage,
            startDate: product.promoStartDate
              ? dayjs(product.promoStartDate).format("YYYY-MM-DD")
              : "",
            endDate: product.promoEndDate
              ? dayjs(product.promoEndDate).format("YYYY-MM-DD")
              : "",
          },
        };

        if (product.promoPriceList) {
          Object.entries(product.promoPriceList).forEach(([outlet, promo]) => {
            let outletType = promo.promoType || "quantity";
            let outletPaid = 0;
            let outletFree = 0;
            let outletPercentage = promo.promoPercentage || 0;

            if (
              outletType === "quantity" &&
              promo.promoPlan &&
              promo.promoPlan !== "None"
            ) {
              const [p, f] = promo.promoPlan.split("+").map(Number);
              outletPaid = p;
              outletFree = f;
            }

            initialPromotions[product._id][outlet] = {
              type: outletType,
              paid: outletPaid,
              free: outletFree,
              percentage: outletPercentage,
              startDate: promo.promoStartDate
                ? dayjs(promo.promoStartDate).format("YYYY-MM-DD")
                : "",
              endDate: promo.promoEndDate
                ? dayjs(promo.promoEndDate).format("YYYY-MM-DD")
                : "",
            };
          });
        }
      });

      setSelectedPromotions(initialPromotions);
      setExpandedPromos(initialExpanded);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromotionChange = (productId, level, field, value) => {
    setSelectedPromotions((prev) => {
      const productPromos = { ...prev[productId] };
      const current = productPromos[level] || {};
      let updated = { ...current };

      if (field === "type") {
        updated = {
          ...updated,
          type: value,
          paid: 0,
          free: 0,
          percentage: 0,
        };
      } else if (field === "paid" || field === "free") {
        const numValue = parseInt(value) || 0;
        updated = {
          ...updated,
          [field]: numValue,
        };
      } else if (field === "percentage") {
        updated = {
          ...updated,
          percentage: parseFloat(value) || 0,
        };
      } else {
        updated[field] = value;
      }

      productPromos[level] = updated;
      return {
        ...prev,
        [productId]: productPromos,
      };
    });
  };

  const calculatePromotionalPrice = (
    original,
    promotion,
    forDisplay = false,
  ) => {
    // If original is not a valid number, return 0 for display or calculations
    const validOriginal =
      typeof original === "number" && !isNaN(original) ? original : 0;

    // If no promotion exists or promotion has no effect, return original price
    if (
      !promotion ||
      (promotion.type === "quantity" &&
        (!promotion.paid || promotion.paid === 0)) ||
      (promotion.type === "percentage" &&
        (!promotion.percentage || promotion.percentage === 0))
    ) {
      return forDisplay ? validOriginal.toFixed(2) : validOriginal;
    }

    if (promotion.type === "percentage") {
      const result = validOriginal * (1 - (promotion.percentage || 0) / 100);
      return forDisplay ? result.toFixed(2) : result;
    }

    if (promotion.type === "quantity") {
      const paid = promotion.paid || 0;
      const total = paid + (promotion.free || 0);
      if (paid === 0 || total === 0) {
        return forDisplay ? validOriginal.toFixed(2) : validOriginal;
      }
      const result = (validOriginal * paid) / total;
      return forDisplay ? result.toFixed(2) : result;
    }

    return forDisplay ? validOriginal.toFixed(2) : validOriginal;
  };

  const validateDates = (startDate, endDate) => {
    if (startDate && endDate && dayjs(startDate).isAfter(dayjs(endDate))) {
      return false;
    }
    return true;
  };

  const savePromotion = async (product) => {
    const promotions = selectedPromotions[product._id] || {};
    const basePromo = promotions.base || {};

    if (!validateDates(basePromo.startDate, basePromo.endDate)) {
      toast.error("Start date must be before end date for base promotion");
      return;
    }

    const updatedProduct = {
      ...product,
      promoType: basePromo.type || "none",
      promoPlan:
        basePromo.type === "quantity" && basePromo.paid > 0
          ? `${basePromo.paid}+${basePromo.free || 0}`
          : "None",
      promoPercentage:
        basePromo.type === "percentage" && basePromo.percentage > 0
          ? basePromo.percentage
          : 0,
      promoDP: calculatePromotionalPrice(product.dp, basePromo), // Full precision for DB
      promoTP: calculatePromotionalPrice(product.tp, basePromo), // Full precision for DB
      promoStartDate: basePromo.startDate || null,
      promoEndDate: basePromo.endDate || null,
      promoPriceList: {},
    };

    Object.entries(promotions).forEach(([level, promo]) => {
      if (level === "base" || !product.priceList?.[level]) return;

      if (!validateDates(promo.startDate, promo.endDate)) {
        toast.error(`Start date must be before end date for ${level}`);
        return;
      }

      updatedProduct.promoPriceList[level] = {
        promoType: promo.type || "none",
        promoPlan:
          promo.type === "quantity" && promo.paid > 0
            ? `${promo.paid}+${promo.free || 0}`
            : "None",
        promoPercentage:
          promo.type === "percentage" && promo.percentage > 0
            ? promo.percentage
            : 0,
        promoDP: calculatePromotionalPrice(product.priceList[level].dp, promo), // Full precision for DB
        promoTP: calculatePromotionalPrice(product.priceList[level].tp, promo), // Full precision for DB
        promoStartDate: promo.startDate || null,
        promoEndDate: promo.endDate || null,
      };
    });

    try {
      await axios.put(
        `http://175.29.181.245:15001/products/${product._id}`,
        updatedProduct,
      );
      toast.success("Promotions saved successfully!");
      fetchProducts();
    } catch (error) {
      console.error("Error saving promotions:", error);
      toast.error("Failed to save promotions");
    }
  };

  const removePromotion = async (product) => {
    const updatedProduct = {
      ...product,
      promoType: "none",
      promoPlan: "None",
      promoPercentage: 0,
      promoDP: product.dp || 0,
      promoTP: product.tp || 0,
      promoStartDate: null,
      promoEndDate: null,
      promoPriceList: {},
    };

    if (product.promoPriceList) {
      Object.keys(product.promoPriceList).forEach((outlet) => {
        if (product.priceList?.[outlet]) {
          updatedProduct.promoPriceList[outlet] = {
            promoType: "none",
            promoPlan: "None",
            promoPercentage: 0,
            promoDP: product.priceList[outlet].dp || 0,
            promoTP: product.priceList[outlet].tp || 0,
            promoStartDate: null,
            promoEndDate: null,
          };
        }
      });
    }

    try {
      await axios.put(
        `http://175.29.181.245:15001/products/${product._id}`,
        updatedProduct,
      );
      toast.success("Promotions removed successfully!");
      fetchProducts();
    } catch (error) {
      console.error("Error removing promotions:", error);
      toast.error("Failed to remove promotions");
    }
  };

  const togglePromoList = (productId) => {
    setExpandedPromos((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setImportFile(uploadedFile);
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const processDate = (rawDate) => {
    if (!rawDate) return "";
    if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return rawDate;
    }
    if (rawDate instanceof Date) {
      return dayjs(rawDate).format("YYYY-MM-DD");
    }
    throw new Error(`Invalid date format: ${rawDate}. Use YYYY-MM-DD.`);
  };

  const processExcelData = async (data) => {
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [index, row] of data.entries()) {
      try {
        if (!row["Product ID"] && !row["Product Name"]) continue;

        const product = allProducts.find(
          (p) => p._id === row["Product ID"] || p.name === row["Product Name"],
        );
        if (!product) {
          throw new Error("Product not found");
        }

        // Parse base promotion
        const baseType = row["Promo Type"] || "quantity";
        const basePaid = parseInt(row["Paid Quantity"] || 0);
        const baseFree = parseInt(row["Free Quantity"] || 0);
        const basePercentage = parseFloat(row["Percentage"] || 0);
        const baseStartDate = processDate(row["Start Date"]);
        const baseEndDate = processDate(row["End Date"]);

        if (!validateDates(baseStartDate, baseEndDate)) {
          throw new Error("Base start date must be before end date");
        }

        const basePromotion = {
          type: baseType,
          paid: basePaid,
          free: baseFree,
          percentage: basePercentage,
          startDate: baseStartDate,
          endDate: baseEndDate,
        };

        // Parse outlet promotions
        const outletPromoColumns = {};
        Object.keys(row).forEach((key) => {
          const match = key.match(
            /^(.+) (Promo Type|Paid Quantity|Free Quantity|Percentage|Start Date|End Date)$/,
          );
          if (match) {
            const outlet = match[1];
            const field = match[2].replace(/ /g, "");
            if (!outletPromoColumns[outlet]) outletPromoColumns[outlet] = {};
            outletPromoColumns[outlet][field] = row[key];
          }
        });

        const promoPriceList = {};
        for (const [outlet, col] of Object.entries(outletPromoColumns)) {
          if (!product.priceList?.[outlet]) continue; // Skip if outlet not in priceList

          const outletType = col.PromoType || "quantity";
          const outletPaid = parseInt(col.PaidQuantity || 0);
          const outletFree = parseInt(col.FreeQuantity || 0);
          const outletPercentage = parseFloat(col.Percentage || 0);
          const outletStartDate = processDate(col.StartDate);
          const outletEndDate = processDate(col.EndDate);

          if (!validateDates(outletStartDate, outletEndDate)) {
            throw new Error(`${outlet} start date must be before end date`);
          }

          const outletPromotion = {
            type: outletType,
            paid: outletPaid,
            free: outletFree,
            percentage: outletPercentage,
            startDate: outletStartDate,
            endDate: outletEndDate,
          };

          promoPriceList[outlet] = {
            promoType: outletType,
            promoPlan:
              outletType === "quantity" && outletPaid > 0
                ? `${outletPaid}+${outletFree}`
                : "None",
            promoPercentage:
              outletType === "percentage" && outletPercentage > 0
                ? outletPercentage
                : 0,
            promoDP: calculatePromotionalPrice(
              product.priceList[outlet].dp,
              outletPromotion,
            ),
            promoTP: calculatePromotionalPrice(
              product.priceList[outlet].tp,
              outletPromotion,
            ),
            promoStartDate: outletStartDate || null,
            promoEndDate: outletEndDate || null,
          };
        }

        const updatedProduct = {
          ...product,
          promoType: baseType,
          promoPlan:
            baseType === "quantity" && basePaid > 0
              ? `${basePaid}+${baseFree}`
              : "None",
          promoPercentage:
            baseType === "percentage" && basePercentage > 0
              ? basePercentage
              : 0,
          promoDP: calculatePromotionalPrice(product.dp, basePromotion), // Full precision for DB
          promoTP: calculatePromotionalPrice(product.tp, basePromotion), // Full precision for DB
          promoStartDate: baseStartDate || null,
          promoEndDate: baseEndDate || null,
          promoPriceList,
        };

        await axios.put(
          `http://175.29.181.245:15001/products/${product._id}`,
          updatedProduct,
        );

        successCount++;
      } catch (error) {
        console.error(`Error processing row ${index + 2}:`, error);
        errors.push(`Row ${index + 2}: ${error.message}`);
        errorCount++;
      }
    }

    if (errors.length > 0) {
      toast.error(`Errors in ${errors.length} rows: ${errors.join(", ")}`, {
        duration: 8000,
      });
    }

    return { successCount, errorCount };
  };

  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error("Please select a file first");
      return;
    }

    setImportLoading(true);

    try {
      const data = await readExcelFile(importFile);
      const { successCount, errorCount } = await processExcelData(data);

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} promotions`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} promotions`);
      }

      fetchProducts();
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error(
        "Failed to process the file. Please check the format and try again.",
      );
    } finally {
      setImportLoading(false);
      setImportFile(null);
      document.getElementById("import-file").value = "";
    }
  };

  const downloadDemoFile = () => {
    const allOutlets = new Set();
    allProducts.forEach((product) => {
      if (product.priceList) {
        Object.keys(product.priceList).forEach((outlet) =>
          allOutlets.add(outlet),
        );
      }
    });

    const demoData = allProducts.map((product) => {
      const row = {
        "Product ID": product._id,
        "Product Name": product.name,
        "Price DP": product.dp || 0,
        "Price TP": product.tp || 0,
        "Promo Type": "quantity",
        "Paid Quantity": "",
        "Free Quantity": "",
        Percentage: "",
        "Start Date": "",
        "End Date": "",
      };

      allOutlets.forEach((outlet) => {
        row[`${outlet} Promo Type`] = "quantity";
        row[`${outlet} Paid Quantity`] = "";
        row[`${outlet} Free Quantity`] = "";
        row[`${outlet} Percentage`] = "";
        row[`${outlet} Start Date`] = "";
        row[`${outlet} End Date`] = "";
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(demoData);

    if (!worksheet["!cols"]) worksheet["!cols"] = [];
    const dateColumns = [8, 9]; // Base Start/End
    let colIndex = 10; // After base
    allOutlets.forEach(() => {
      dateColumns.push(colIndex + 4); // Start Date for outlet
      dateColumns.push(colIndex + 5); // End Date for outlet
      colIndex += 6; // 6 columns per outlet
    });

    dateColumns.forEach((col) => {
      worksheet["!cols"][col] = {
        wch: 12,
        t: "d",
        z: "yyyy-mm-dd",
      };
    });

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [
          "IMPORTANT: Date columns must use YYYY-MM-DD format (e.g., 2023-12-31)",
        ],
      ],
      { origin: -1 },
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Promotions");

    const today = dayjs().format("YYYY-MM-DD");
    XLSX.writeFile(workbook, `Promotions_Template_${today}.xlsx`);
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6">
          Promotional Management
        </h2>

        <div className="mb-4 flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 p-3 rounded-lg w-full max-w-md shadow-sm"
          />

          <div className="flex gap-2">
            <button
              onClick={downloadDemoFile}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <FaFileDownload /> Download Template
            </button>

            <div className="relative">
              <input
                id="import-file"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="import-file"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2 cursor-pointer"
              >
                <FaFileImport /> Import Promotions
              </label>
            </div>

            {importFile && (
              <button
                onClick={handleBulkImport}
                disabled={importLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2 disabled:bg-gray-400"
              >
                {importLoading ? "Processing..." : "Apply Import"}
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <h3 className="font-medium text-yellow-800">Import Instructions:</h3>
          <ol className="list-decimal pl-5 text-sm text-yellow-700 space-y-1">
            <li>Download the template file to get the correct format</li>
            <li>
              Fill in the promotion details (either Paid+Free quantities or
              Percentage) for base and outlets
            </li>
            <li>
              <strong>Date format must be YYYY-MM-DD (e.g., 2023-12-31)</strong>
              <ul className="list-disc pl-5 mt-1">
                <li>
                  In Excel, right-click the date cell → Format Cells → Custom →
                  Type: yyyy-mm-dd
                </li>
                <li>
                  Or enter dates directly in this format (text format also
                  works)
                </li>
                <li>Example dates are provided in the template</li>
              </ul>
            </li>
            <li>Start date must be before end date for each promotion level</li>
            <li>Do not modify the "Product ID" or "Product Name" columns</li>
            <li>Upload the completed file</li>
          </ol>
        </div>

        <div className="overflow-x-auto shadow-md rounded-lg bg-white">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
              <tr>
                <th className="p-3 w-8"></th> {/* Expand column */}
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-center">DP</th>
                <th className="p-3 text-center">TP</th>
                <th className="p-3 text-center">Promo Type</th>
                <th className="p-3 text-center">Promotion</th>
                <th className="p-3 text-center">Promo DP</th>
                <th className="p-3 text-center">Promo TP</th>
                <th className="p-3 text-center">Validity</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const promotions = selectedPromotions[product._id] || {};
                  const basePromo = promotions.base || {};
                  return (
                    <>
                      <tr
                        key={product._id}
                        className="border-b hover:bg-gray-50 transition duration-200"
                      >
                        <td className="p-3 text-center">
                          {product.priceList &&
                            Object.keys(product.priceList).length > 0 && (
                              <button
                                onClick={() => togglePromoList(product._id)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {expandedPromos[product._id] ? (
                                  <ChevronUp size={18} />
                                ) : (
                                  <ChevronDown size={18} />
                                )}
                              </button>
                            )}
                        </td>
                        <td className="p-3 font-medium text-gray-800">
                          {product.name}
                        </td>
                        <td className="p-3 text-center">{product.dp || 0}</td>
                        <td className="p-3 text-center">{product.tp || 0}</td>
                        <td className="p-3 text-center">
                          <select
                            value={basePromo.type || "quantity"}
                            onChange={(e) =>
                              handlePromotionChange(
                                product._id,
                                "base",
                                "type",
                                e.target.value,
                              )
                            }
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="quantity">Quantity</option>
                            <option value="percentage">Percentage</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          {basePromo.type === "quantity" ? (
                            <div className="flex justify-center space-x-1">
                              <input
                                type="number"
                                min="0"
                                value={basePromo.paid || ""}
                                onChange={(e) =>
                                  handlePromotionChange(
                                    product._id,
                                    "base",
                                    "paid",
                                    e.target.value,
                                  )
                                }
                                className="w-12 text-center border rounded"
                              />
                              <span className="self-center">+</span>
                              <input
                                type="number"
                                min="0"
                                value={basePromo.free || ""}
                                onChange={(e) =>
                                  handlePromotionChange(
                                    product._id,
                                    "base",
                                    "free",
                                    e.target.value,
                                  )
                                }
                                className="w-12 text-center border rounded"
                              />
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={basePromo.percentage || ""}
                              onChange={(e) =>
                                handlePromotionChange(
                                  product._id,
                                  "base",
                                  "percentage",
                                  e.target.value,
                                )
                              }
                              className="w-16 text-center border rounded"
                              placeholder="%"
                            />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {calculatePromotionalPrice(
                            product.dp,
                            basePromo,
                            true,
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {calculatePromotionalPrice(
                            product.tp,
                            basePromo,
                            true,
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col space-y-1">
                            <input
                              type="date"
                              value={basePromo.startDate || ""}
                              onChange={(e) =>
                                handlePromotionChange(
                                  product._id,
                                  "base",
                                  "startDate",
                                  e.target.value,
                                )
                              }
                              className="text-sm p-1 border rounded"
                            />
                            <input
                              type="date"
                              value={basePromo.endDate || ""}
                              onChange={(e) =>
                                handlePromotionChange(
                                  product._id,
                                  "base",
                                  "endDate",
                                  e.target.value,
                                )
                              }
                              className="text-sm p-1 border rounded"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() => savePromotion(product)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center space-x-1"
                            >
                              <FaSave />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => removePromotion(product)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded flex items-center space-x-1"
                            >
                              <FaTrash />
                              <span>Remove</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedPromos[product._id] && product.priceList && (
                        <tr className="bg-gray-50">
                          <td colSpan="10" className="px-6 py-4">
                            <div className="ml-8">
                              <h4 className="font-medium text-gray-700 mb-2">
                                Outlet Specific Promotions
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(product.priceList).map(
                                  ([outlet, prices]) => {
                                    const outletPromo = promotions[outlet] || {
                                      type: "quantity",
                                      paid: 0,
                                      free: 0,
                                      percentage: 0,
                                      startDate: "",
                                      endDate: "",
                                    };
                                    return (
                                      <div
                                        key={outlet}
                                        className="border p-3 rounded bg-white"
                                      >
                                        <h5 className="font-medium capitalize mb-2">
                                          {outlet}
                                        </h5>
                                        <div className="space-y-2">
                                          <div>
                                            <label className="text-xs text-gray-500 block">
                                              Promo Type
                                            </label>
                                            <select
                                              value={outletPromo.type}
                                              onChange={(e) =>
                                                handlePromotionChange(
                                                  product._id,
                                                  outlet,
                                                  "type",
                                                  e.target.value,
                                                )
                                              }
                                              className="w-full border rounded px-2 py-1 text-sm"
                                            >
                                              <option value="quantity">
                                                Quantity
                                              </option>
                                              <option value="percentage">
                                                Percentage
                                              </option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500 block">
                                              Promotion
                                            </label>
                                            {outletPromo.type === "quantity" ? (
                                              <div className="flex space-x-1">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={outletPromo.paid || ""}
                                                  onChange={(e) =>
                                                    handlePromotionChange(
                                                      product._id,
                                                      outlet,
                                                      "paid",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="w-1/2 text-center border rounded"
                                                />
                                                <span className="self-center">
                                                  +
                                                </span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={outletPromo.free || ""}
                                                  onChange={(e) =>
                                                    handlePromotionChange(
                                                      product._id,
                                                      outlet,
                                                      "free",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="w-1/2 text-center border rounded"
                                                />
                                              </div>
                                            ) : (
                                              <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={
                                                  outletPromo.percentage || ""
                                                }
                                                onChange={(e) =>
                                                  handlePromotionChange(
                                                    product._id,
                                                    outlet,
                                                    "percentage",
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full text-center border rounded"
                                                placeholder="%"
                                              />
                                            )}
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500 block">
                                              Promo DP / TP
                                            </label>
                                            <div className="flex justify-between text-sm">
                                              <span>
                                                {calculatePromotionalPrice(
                                                  prices.dp,
                                                  outletPromo,
                                                  true,
                                                )}
                                              </span>
                                              <span>
                                                {calculatePromotionalPrice(
                                                  prices.tp,
                                                  outletPromo,
                                                  true,
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500 block">
                                              Validity
                                            </label>
                                            <div className="space-y-1">
                                              <input
                                                type="date"
                                                value={
                                                  outletPromo.startDate || ""
                                                }
                                                onChange={(e) =>
                                                  handlePromotionChange(
                                                    product._id,
                                                    outlet,
                                                    "startDate",
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full text-sm p-1 border rounded"
                                              />
                                              <input
                                                type="date"
                                                value={
                                                  outletPromo.endDate || ""
                                                }
                                                onChange={(e) =>
                                                  handlePromotionChange(
                                                    product._id,
                                                    outlet,
                                                    "endDate",
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full text-sm p-1 border rounded"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!debouncedSearch && !loading && totalPages > 1 && (
          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 bg-gray-200 rounded">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
