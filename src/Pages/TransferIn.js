import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { FaFileDownload, FaFileImport } from "react-icons/fa";

export default function TransferIn({
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
  const [importErrors, setImportErrors] = useState([]); // <-- new

  const isAdminPanel = !!allProducts;

  const isPromoValid = (product, priceLabel) => {
    if (priceLabel) {
      const promoDetails = product.promoPriceList?.[priceLabel];
      if (!promoDetails?.promoStartDate || !promoDetails?.promoEndDate)
        return false;
      const today = dayjs().startOf("day");
      const start = dayjs(promoDetails.promoStartDate);
      const end = dayjs(promoDetails.promoEndDate);
      return today.isAfter(start) && today.isBefore(end);
    } else {
      if (!product.promoStartDate || !product.promoEndDate) return false;
      const today = dayjs().startOf("day");
      const start = dayjs(product.promoStartDate);
      const end = dayjs(product.promoEndDate);
      return today.isAfter(start) && today.isBefore(end);
    }
  };

  const getCurrentTP = (product) => {
    const priceLabel = user.pricelabel;
    if (priceLabel) {
      const outletTP = product.priceList?.[priceLabel]?.tp;
      if (
        isPromoValid(product, priceLabel) &&
        product.promoPriceList?.[priceLabel]?.promoTP
      ) {
        return product.promoPriceList[priceLabel].promoTP;
      }
      return outletTP ?? product.tp;
    } else {
      if (isPromoValid(product, priceLabel) && product.promoTP)
        return product.promoTP;
      return product.tp;
    }
  };

  const getCurrentDP = (product) => {
    const priceLabel = user.pricelabel;
    if (priceLabel) {
      const outletDP = product.priceList?.[priceLabel]?.dp;
      if (
        isPromoValid(product, priceLabel) &&
        product.promoPriceList?.[priceLabel]?.promoDP
      ) {
        return product.promoPriceList[priceLabel].promoDP;
      }
      return outletDP ?? product.dp;
    } else {
      if (isPromoValid(product, priceLabel) && product.promoDP)
        return product.promoDP;
      return product.dp;
    }
  };

  /* ------------------------------------------------------------------ */
  /* SEARCH */
  /* ------------------------------------------------------------------ */
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
    const alreadyAdded = cart.find((i) => i.barcode === product.barcode);
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
          transferIn: 0,
          currentDP,
          currentTP,
          currentStockDP,
          currentStockTP,
          editableDP: currentDP,
          editableTP: currentTP,
          total: 0,
        },
      ]);
      setSearch("");
    } catch (err) {
      console.error("Stock fetch error:", err);
      toast.error("Failed to fetch stock.");
    }
  };

  /* ------------------------------------------------------------------ */
  /* EXCEL IMPORT – FIXED */
  /* ------------------------------------------------------------------ */
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const processExcelData = async (data) => {
    setImportLoading(true);
    setImportErrors([]);
    let successCount = 0;
    const failed = [];

    try {
      for (const row of data) {
        try {
          // ---- 1. Skip empty rows -------------------------------------------------
          if (!row["Barcode"] && !row["Product Name"]) continue;

          const transferQty = parseInt(row["Transfer Quantity"] || 0);
          if (transferQty <= 0) continue;

          // ---- 2. Identify product ------------------------------------------------
          let product;
          let identifier = row["Barcode"]
            ? String(row["Barcode"]).trim()
            : row["Product Name"]
              ? row["Product Name"].trim()
              : "Unknown";

          if (isAdminPanel) {
            // Admin panel – allProducts is already loaded
            product = allProducts.find(
              (p) =>
                p.barcode === String(row["Barcode"] || "").trim() ||
                p.name.trim() === (row["Product Name"] || "").trim(),
            );
            if (!product) {
              failed.push({
                identifier,
                reason: "Product not found in allProducts",
              });
              continue;
            }
          } else {
            // Normal outlet – search via API (barcode first, then name)
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
                reason: "No barcode or name",
              });
              continue;
            }

            const res = await axios.get(
              "http://175.29.181.245:15001/search-product",
              {
                params: { search: searchValue, type: searchType },
              },
            );

            if (!res.data || res.data.length === 0) {
              failed.push({
                identifier,
                reason: "Product not found via search",
              });
              continue;
            }
            product = res.data[0];
          }

          // ---- 3. Get current stock ------------------------------------------------
          const encodedOutlet = encodeURIComponent(user.outlet);
          const stockRes = await axios.get(
            `http://175.29.181.245:15001/outlet-stock?barcode=${product.barcode}&outlet=${encodedOutlet}`,
          );

          const currentStock = stockRes.data?.stock?.currentStock ?? 0;
          const currentStockDP = stockRes.data?.stock?.currentStockValueDP ?? 0;
          const currentStockTP = stockRes.data?.stock?.currentStockValueTP ?? 0;

          const currentDP = row["DP"]
            ? parseFloat(row["DP"])
            : getCurrentDP(product);
          const currentTP = row["TP"]
            ? parseFloat(row["TP"])
            : getCurrentTP(product);

          // ---- 4. Add / replace in cart --------------------------------------------
          setCart((prev) => [
            ...prev.filter((i) => i.barcode !== product.barcode),
            {
              ...product,
              openingStock: currentStock,
              transferIn: transferQty,
              currentDP,
              currentTP,
              currentStockDP,
              currentStockTP,
              editableDP: currentDP,
              editableTP: currentTP,
              total: transferQty * currentDP,
            },
          ]);

          successCount++;
        } catch (err) {
          console.error("Row processing error:", err);
          const id = row["Barcode"]
            ? String(row["Barcode"]).trim()
            : row["Product Name"]
              ? row["Product Name"].trim()
              : "Unknown";
          failed.push({
            identifier: id,
            reason: err.message || "Unknown error",
          });
        }
      }

      if (successCount) toast.success(`Imported ${successCount} products`);
      if (failed.length)
        toast.error(`Failed ${failed.length} rows – see details`);
      setImportErrors(failed);
    } catch (err) {
      console.error("Excel processing error:", err);
      toast.error("Failed to process file");
    } finally {
      setImportLoading(false);
      setImportFile(null);
      document.getElementById("import-file").value = "";
    }
  };

  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error("Select a file first");
      return;
    }
    try {
      const data = await readExcelFile(importFile);
      await processExcelData(data);
    } catch (err) {
      toast.error("Failed to import file");
    }
  };

  const downloadDemoFile = async () => {
    try {
      const rows = isAdminPanel
        ? allProducts.map((p) => ({
            Barcode: p.barcode,
            "Product Name": p.name,
            "Transfer Quantity": "0",
            DP: p.dp,
            TP: p.tp,
          }))
        : [
            {
              Barcode: "123456789",
              "Product Name": "Sample Product",
              "Transfer Quantity": "0",
              DP: "100.00",
              TP: "120.00",
            },
            {
              Barcode: "987654321",
              "Product Name": "Another Product",
              "Transfer Quantity": "0",
              DP: "150.00",
              TP: "180.00",
            },
          ];

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.sheet_add_aoa(
        ws,
        [
          ["IMPORTANT: Keep exact column names, edit only values"],
          ["1. Set 'Transfer Quantity' > 0 (0 is ignored)"],
          ["2. DP/TP optional – current prices used if omitted"],
        ],
        { origin: -1 },
      );
      ws["!cols"] = [
        { wch: 15 },
        { wch: 40 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transfer In");
      XLSX.writeFile(wb, "Transfer_In_Template.xlsx");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate template");
    }
  };

  /* ------------------------------------------------------------------ */
  /* CART HELPERS */
  /* ------------------------------------------------------------------ */
  const updateTransferInValue = (barcode, value) => {
    const qty = parseInt(value) || 0;
    setCart((prev) =>
      prev.map((i) =>
        i.barcode === barcode
          ? { ...i, transferIn: qty, total: qty * i.editableDP }
          : i,
      ),
    );
  };

  const handlePriceChange = (barcode, field, value) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.barcode !== barcode) return i;
        const newVal = parseFloat(value) || 0;
        return {
          ...i,
          [field]: newVal,
          total: field === "editableDP" ? newVal * i.transferIn : i.total,
        };
      }),
    );
  };

  const removeFromCart = (barcode) => {
    setCart((prev) => prev.filter((i) => i.barcode !== barcode));
  };

  /* ------------------------------------------------------------------ */
  /* SUBMIT */
  /* ------------------------------------------------------------------ */
  const handleSubmit = async () => {
    if (!cart.length) return;
    setIsSubmitting(true);
    const formatted = dayjs(selectedDate).format("YYYY-MM-DD HH:mm:ss");

    try {
      const requests = cart.map(async (item) => {
        await axios.put("http://175.29.181.245:15001/update-outlet-stock", {
          barcode: item.barcode,
          outlet: user.outlet,
          newStock: item.openingStock + item.transferIn,
          currentStockValueDP:
            item.currentStockDP + item.transferIn * item.editableDP,
          currentStockValueTP:
            item.currentStockTP + item.transferIn * item.editableTP,
        });

        await axios.post("http://175.29.181.245:15001/stock-transactions", {
          barcode: item.barcode,
          outlet: user.outlet,
          type: "transfer in",
          asm: user.asm,
          rsm: user.rsm,
          som: user.som,
          zone: user.zone,
          pricelabel: user.pricelabel,
          quantity: item.transferIn,
          date: formatted,
          user: user.name,
          userID: user._id,
          dp: item.editableDP,
          tp: item.editableTP,
        });
      });

      await Promise.all(requests);
      toast.success("Transfer In processed!");
      getStockValue(user.outlet);
      setCart([]);
      setSearch("");
      setSearchResults([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to process transfer in");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* RENDER */
  /* ------------------------------------------------------------------ */
  return (
    <div className="p-4 w-full max-w-md mx-auto bg-gray-100 min-h-screen">
      {/* Date & Stock */}
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
            <p>Stock (TP): {stock.tp?.toLocaleString()}</p>
          </span>
        )}
      </div>

      {/* Admin Import Controls */}
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
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="import-file"
              className="bg-green-600 hover:bg-green-700 w-[200px] font-bold text-white px-3 py-2 rounded flex items-center gap-1 cursor-pointer text-sm"
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

          {/* Import Errors */}
          {importErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-100 rounded shadow">
              <h4 className="text-lg font-bold mb-2">Import Errors:</h4>
              <ul className="list-disc pl-5">
                {importErrors.map((e, i) => (
                  <li key={i} className="text-sm text-red-700">
                    {e.identifier}: {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Totals */}
      <div className="bg-white p-4 shadow rounded-lg mb-4">
        <div className="flex flex-row-reverse justify-between">
          <span className="text-lg font-bold">
            Total (TP):{" "}
            {cart
              .reduce((s, i) => s + i.editableTP * i.transferIn, 0)
              .toFixed(2)}{" "}
            BDT
          </span>
          <span className="text-lg font-bold">
            Total Qty: {cart.reduce((s, i) => s + i.transferIn, 0)}
          </span>
        </div>
      </div>

      {/* Search */}
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
          className="absolute right-0 top-0 p-1 mt-1 mr-1 bg-white border rounded"
        >
          <option value="name">By Name</option>
          <option value="barcode">By Barcode</option>
        </select>

        {search && (
          <ul className="absolute bg-white w-full border rounded-lg mt-1 shadow z-10">
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

      {/* Table */}
      <div className="bg-white p-4 shadow rounded-lg mb-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-200">
              <th className="p-2 text-left">Product</th>
              <th className="p-2 text-center">Stock</th>
              <th className="p-2 text-center">TP</th>
              <th className="p-2 text-center">Transfer In</th>
              <th className="p-2 text-center">New Stock</th>
              <th className="p-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item) => (
              <tr key={item.barcode} className="border-b">
                <td className="p-2 text-left break-words max-w-[120px] whitespace-normal">
                  {item.name}
                </td>
                <td className="p-2 text-center">{item.openingStock}</td>
                <td className="p-2 text-center">
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
                    className="w-full p-1 border rounded text-center text-xs"
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="number"
                    value={item.transferIn}
                    onChange={(e) =>
                      updateTransferInValue(item.barcode, e.target.value)
                    }
                    className="w-full p-1 border rounded text-center"
                    min="0"
                  />
                </td>
                <td className="p-2 text-center">
                  {item.openingStock + item.transferIn}
                </td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => removeFromCart(item.barcode)}
                    className="text-red-600"
                  >
                    <svg
                      className="w-4 h-4 mx-auto"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 448 512"
                    >
                      <path
                        fill="currentColor"
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

      {/* Submit */}
      <div className="bg-white p-4 shadow rounded-lg">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center w-full h-[40px]"
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </div>
  );
}
