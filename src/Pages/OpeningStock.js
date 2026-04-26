import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { FaFileDownload, FaFileImport } from "react-icons/fa";

export default function OpeningStock({
  user,
  stock,
  getStockValue,
  allProducts,
}) {
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState("name");
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    dayjs().format("YYYY-MM-DD"),
  );
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importErrors, setImportErrors] = useState([]);

  const isAdminPanel = !!allProducts;

  const isPromoValid = (product) => {
    const priceLabel = user.pricelabel;
    const promoDetails = product.promoPriceList?.[priceLabel];

    if (!promoDetails?.promoStartDate || !promoDetails?.promoEndDate)
      return false;

    const today = dayjs().startOf("day");
    const startDate = dayjs(promoDetails.promoStartDate);
    const endDate = dayjs(promoDetails.promoEndDate);

    return today.isAfter(startDate) && today.isBefore(endDate);
  };

  const getCurrentTP = (product) => {
    const priceLabel = user.pricelabel;
    const outletTP = product.priceList?.[priceLabel]?.tp;

    if (
      isPromoValid(product) &&
      product.promoPriceList?.[priceLabel]?.promoTP
    ) {
      return product.promoPriceList[priceLabel].promoTP;
    }
    return outletTP ?? product.tp;
  };

  const getCurrentDP = (product) => {
    const priceLabel = user.pricelabel;
    const outletDP = product.priceList?.[priceLabel]?.dp;

    if (
      isPromoValid(product) &&
      product.promoPriceList?.[priceLabel]?.promoDP
    ) {
      return product.promoPriceList[priceLabel].promoDP;
    }
    return outletDP ?? product.dp;
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (query.length > 2) {
      setIsLoading(true);
      try {
        const response = await axios.get(
          "http://175.29.181.245:15001/search-product",
          { params: { search: query, type: searchType } },
        );
        setSearchResults(response.data);
      } catch (error) {
        console.error("Search error:", error);
        toast.error("Failed to search products");
      } finally {
        setIsLoading(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const addToCart = async (product) => {
    const alreadyAdded = cart.find((item) => item.barcode === product.barcode);
    if (alreadyAdded) {
      toast.error("Already added to cart!");
      return;
    }

    try {
      const encodedOutlet = encodeURIComponent(user.outlet);
      const stockRes = await axios.get(
        `http://175.29.181.245:15001/outlet-stock?barcode=${product.barcode}&outlet=${encodedOutlet}`,
      );

      const currentStock = stockRes.data?.stock?.currentStock ?? 0;
      const currentStockDP = stockRes.data?.stock?.currentStockValueDP ?? 0;
      const currentStockTP = stockRes.data?.stock?.currentStockValueTP ?? 0;
      const currentDP = getCurrentDP(product);
      const currentTP = getCurrentTP(product);

      setCart((prev) => [
        ...prev,
        {
          ...product,
          openingStock: currentStock,
          newStock: currentStock,
          currentDP,
          currentTP,
          currentStockDP,
          currentStockTP,
          editableDP: currentDP,
          editableTP: currentTP,
          canEdit: currentStock === 0,
          total: currentStock * currentTP,
        },
      ]);
      setSearch("");
    } catch (err) {
      console.error("Stock fetch error:", err);
      toast.error("Failed to fetch stock. Please try again.");
    }
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

  const processExcelData = async (data) => {
    setImportLoading(true);
    setImportErrors([]);
    let successCount = 0;
    let failed = [];

    try {
      for (const row of data) {
        try {
          if (!row["Barcode"] && !row["Product Name"]) continue;

          const openingQty = parseInt(row["Opening Quantity"] || 0);
          if (openingQty <= 0) continue;

          let product;
          let identifier = row["Barcode"]
            ? String(row["Barcode"]).trim()
            : row["Product Name"]
              ? row["Product Name"].trim()
              : "Unknown";

          if (isAdminPanel) {
            product = allProducts.find(
              (p) =>
                p.barcode === String(row["Barcode"]).trim() ||
                p.name.trim() ===
                  (row["Product Name"] ? row["Product Name"].trim() : ""),
            );
            if (!product) {
              failed.push({
                identifier,
                reason: "Product not found in allProducts",
              });
              continue;
            }
          } else {
            let searchValue, searchType;
            if (row["Barcode"]) {
              searchValue = String(row["Barcode"]).trim();
              searchType = "barcode";
            } else if (row["Product Name"]) {
              searchValue = row["Product Name"].trim();
              searchType = "name";
            } else {
              failed.push({
                identifier: "Unknown",
                reason: "No barcode or product name provided",
              });
              continue;
            }

            const productResponse = await axios.get(
              "http://175.29.181.245:15001/search-product",
              {
                params: {
                  search: searchValue,
                  type: searchType,
                },
              },
            );

            if (!productResponse.data || productResponse.data.length === 0) {
              failed.push({
                identifier: searchValue,
                reason: "Product not found via search",
              });
              continue;
            }
            product = productResponse.data[0];
          }

          const encodedOutlet = encodeURIComponent(user.outlet);
          const stockRes = await axios.get(
            `http://175.29.181.245:15001/outlet-stock?barcode=${product.barcode}&outlet=${encodedOutlet}`,
          );

          const currentStock = stockRes.data?.stock?.currentStock ?? 0;
          const currentStockDP = stockRes.data?.stock?.currentStockValueDP ?? 0;
          const currentStockTP = stockRes.data?.stock?.currentStockValueTP ?? 0;
          const currentDP = row["DP"] || getCurrentDP(product);
          const currentTP = row["TP"] || getCurrentTP(product);

          setCart((prev) => [
            ...prev.filter((item) => item.barcode !== product.barcode),
            {
              ...product,
              openingStock: currentStock,
              newStock: openingQty,
              currentDP,
              currentTP,
              currentStockDP,
              currentStockTP,
              editableDP: currentDP,
              editableTP: currentTP,
              canEdit: currentStock === 0,
              total: openingQty * currentTP,
            },
          ]);

          successCount++;
        } catch (error) {
          console.error(`Error processing row:`, error);
          const identifier = row["Barcode"]
            ? String(row["Barcode"]).trim()
            : row["Product Name"]
              ? row["Product Name"].trim()
              : "Unknown";
          failed.push({ identifier, reason: error.message || "Unknown error" });
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} products successfully`);
      }
      if (failed.length > 0) {
        toast.error(
          `Failed to import ${failed.length} products. See details below.`,
        );
      }
      setImportErrors(failed);
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Failed to process the file");
    } finally {
      setImportLoading(false);
      setImportFile(null);
      document.getElementById("import-file").value = "";
    }
  };

  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error("Please select a file first");
      return;
    }
    try {
      const data = await readExcelFile(importFile);
      await processExcelData(data);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import file");
    }
  };

  const downloadDemoFile = async () => {
    try {
      let productsToExport = [];

      if (isAdminPanel) {
        productsToExport = allProducts.map((product) => ({
          Barcode: product.barcode,
          "Product Name": product.name,
          "Opening Quantity": "0",
          DP: product.dp,
          TP: product.tp,
        }));
      } else {
        productsToExport = [
          {
            Barcode: "123456789",
            "Product Name": "Sample Product",
            "Opening Quantity": "0",
            DP: "100.00",
            TP: "120.00",
          },
          {
            Barcode: "987654321",
            "Product Name": "Another Product",
            "Opening Quantity": "0",
            DP: "150.00",
            TP: "180.00",
          },
        ];
      }

      const worksheet = XLSX.utils.json_to_sheet(productsToExport);

      XLSX.utils.sheet_add_aoa(
        worksheet,
        [
          [
            "IMPORTANT: Maintain this exact format. Only edit the values (not column names)",
          ],
          ["1. Set 'Opening Quantity' to desired value (0 will be ignored)"],
          ["2. DP/TP are optional - will use current prices if omitted"],
          [
            "3. Only products with zero current stock can be edited after import",
          ],
        ],
        { origin: -1 },
      );

      const wscols = [
        { wch: 15 },
        { wch: 40 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
      ];
      worksheet["!cols"] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Opening Stock");
      XLSX.writeFile(workbook, "Opening_Stock_Template.xlsx");
    } catch (error) {
      console.error("Error generating template:", error);
      toast.error("Failed to generate template");
    }
  };

  const updateStockValue = (barcode, value) => {
    const newValue = parseInt(value) || 0;
    setCart((prev) =>
      prev.map((item) =>
        item.barcode === barcode
          ? {
              ...item,
              newStock: newValue,
              total: newValue * item.editableTP,
            }
          : item,
      ),
    );
  };

  const handlePriceChange = (barcode, field, value) => {
    setCart((prev) =>
      prev.map((item) =>
        item.barcode === barcode
          ? {
              ...item,
              [field]: parseFloat(value) || 0,
              total:
                item.newStock *
                (field === "editableTP"
                  ? parseFloat(value) || 0
                  : item.editableTP),
            }
          : item,
      ),
    );
  };

  const removeFromCart = (barcode) => {
    setCart((prev) => prev.filter((item) => item.barcode !== barcode));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const totalTPValue = cart.reduce(
        (sum, item) => sum + item.editableTP * item.newStock,
        0,
      );

      const requests = cart.map(async (item) => {
        if (item.canEdit) {
          await axios.put("http://175.29.181.245:15001/update-outlet-stock", {
            barcode: item.barcode,
            outlet: user.outlet,
            newStock: item.newStock,
            currentStockValueDP: item.newStock * item.editableDP,
            currentStockValueTP: item.newStock * item.editableTP,
            openingStockValueDP: item.newStock * item.editableDP,
            openingStockValueTP: item.newStock * item.editableTP,
          });

          await axios.post("http://175.29.181.245:15001/stock-transactions", {
            barcode: item.barcode,
            outlet: user.outlet,
            type: "opening",
            quantity: item.newStock,
            date: dayjs(selectedDate).format("YYYY-MM-DD HH:mm:ss"),
            asm: user.asm,
            rsm: user.rsm,
            som: user.som,
            zone: user.zone,
            pricelabel: user.pricelabel,
            user: user.name,
            userID: user._id,
            dp: item.editableDP,
            tp: item.editableTP,
          });
        }
      });

      await Promise.all(requests);
      toast.success("Opening stocks updated!");
      getStockValue(user.outlet);
      setCart([]);
      setSearch("");
      setSearchResults([]);
    } catch (err) {
      console.error("Bulk update error:", err);
      toast.error("Failed to update stocks.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 w-full max-w-md mx-auto bg-gray-100 min-h-screen">
      {/* Date & Outlet Stock */}
      <div className="flex justify-between bg-white p-4 shadow rounded-lg mb-4 items-center">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm font-semibold border rounded p-1"
          max={dayjs().format("YYYY-MM-DD")}
        />
        {user?.outlet && (
          <span className="text-sm font-semibold">
            <p>Stock (TP): {stock.tp?.toFixed(2)}</p>
          </span>
        )}
      </div>

      {/* Import/Export Controls */}
      {isAdminPanel && (
        <>
          <div className="flex gap-4 my-4">
            <button
              onClick={downloadDemoFile}
              className="bg-blue-600 hover:bg-blue-700 w-[200px] font-bold text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
            >
              <FaFileDownload /> Template
            </button>
            <input
              id="import-file"
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="import-file"
              className="bg-green-600 hover:bg-green-700 w-[200px] font-bold text-white px-3 py-2 rounded flex items-center gap-1 cursor-pointer text-sm w-full"
            >
              <FaFileImport /> Import
            </label>
            <button
              onClick={handleBulkImport}
              disabled={importLoading || !importFile}
              className="bg-purple-600 hover:bg-purple-700 w-[200px] font-bold text-white px-3 py-2 rounded flex items-center gap-1 text-sm disabled:bg-gray-400"
            >
              {importLoading ? "Processing..." : "Add To Cart"}
            </button>
          </div>
          {importErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-100 rounded shadow">
              <h4 className="text-lg font-bold mb-2">Import Errors:</h4>
              <ul className="list-disc pl-5">
                {importErrors.map((err, i) => (
                  <li key={i} className="text-sm text-red-700">
                    {err.identifier}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Search Box */}
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            handleSearch(e.target.value);
          }}
          placeholder="Search product..."
          className="w-full p-2 border rounded-lg"
        />
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          className="absolute right-[0px] top-[0px] p-[7px] mt-[1px] mr-[1px] bg-white border rounded-lg"
        >
          <option value="name">By Name</option>
          <option value="barcode">By Barcode</option>
        </select>
        {search && (
          <ul className="absolute bg-white w-full border rounded-lg mt-1 shadow">
            {isLoading ? (
              <li className="p-2">Loading...</li>
            ) : (
              searchResults.map((p) => (
                <li
                  key={p._id}
                  onClick={() => addToCart(p)}
                  className="p-2 cursor-pointer hover:bg-gray-200"
                >
                  {p.name} {isPromoValid(p) && "(Promo)"}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Total Quantity and Value */}
      <div className="bg-white p-4 shadow rounded-lg mb-4">
        <div className="flex flex-row-reverse justify-between">
          <span className="text-lg font-bold">
            Total (TP):{" "}
            {cart
              .reduce((sum, item) => sum + item.editableTP * item.newStock, 0)
              .toFixed(2)}{" "}
            BDT
          </span>
          <span className="text-lg font-bold">
            Total Quantity: {cart.reduce((sum, item) => sum + item.newStock, 0)}
          </span>
        </div>
      </div>

      {/* Opening Stock Table */}
      <div className="bg-white p-4 shadow rounded-lg mb-4">
        <div className="overflow-x-hidden w-full">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-200 text-xs">
                <th className="p-2 w-[80px] text-left w-1/3">Product</th>
                <th className="p-2 w-[40px] text-center">Opening</th>
                <th className="p-2 w-[180px] text-center">Price</th>
                <th className="p-2 w-[40px] text-center">Total</th>
                <th className="p-2 w-[40px] text-center"></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.barcode} className="border-b text-xs">
                  <td className="p-2 text-left break-words max-w-[120px] whitespace-normal">
                    {item.name}
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      value={item.newStock}
                      onChange={(e) =>
                        updateStockValue(item.barcode, e.target.value)
                      }
                      className={`border rounded px-1 py-0.5 text-center text-xs w-full max-w-[70px] ${
                        !item.canEdit ? "bg-gray-100" : ""
                      }`}
                      disabled={!item.canEdit}
                    />
                  </td>
                  <td className="p-1 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <input
                        type="number"
                        value={item.editableTP}
                        onChange={(e) =>
                          handlePriceChange(
                            item.barcode,
                            "editableTP",
                            e.target.value,
                          )
                        }
                        className="border rounded px-1 py-0.5 text-center text-xs w-full max-w-[70px]"
                        disabled={!item.canEdit}
                      />
                    </div>
                  </td>
                  <td className="p-2 text-center text-xs">
                    {(item.editableTP * item.newStock).toFixed(2)}
                  </td>
                  <td className="text-center">
                    <button onClick={() => removeFromCart(item.barcode)}>
                      <svg
                        className="w-4 h-4 mx-auto"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 448 512"
                      >
                        <path
                          fill="#FD0032"
                          d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Button */}
      <div className="bg-white p-4 shadow rounded-lg">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center w-full h-[40px] mx-auto"
        >
          {isSubmitting ? (
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              ></path>
            </svg>
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </div>
  );
}
