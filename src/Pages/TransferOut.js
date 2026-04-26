import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { FaFileDownload, FaFileImport } from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";

export default function TransferOut({
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
          transferOut: 0,
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
      toast.error("Failed to fetch stock. Please try again.");
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

          if (currentStock === 0) {
            failed.push({
              identifier,
              reason: "No stock available to transfer out",
            });
            continue;
          }

          const currentDP = getCurrentDP(product);
          const currentTP = row["TP"]
            ? parseFloat(row["TP"])
            : getCurrentTP(product);
          const validTransferQty = Math.min(transferQty, currentStock);

          // ---- 4. Add / replace in cart --------------------------------------------
          setCart((prev) => [
            ...prev.filter((i) => i.barcode !== product.barcode),
            {
              ...product,
              openingStock: currentStock,
              transferOut: validTransferQty,
              currentDP,
              currentTP,
              currentStockDP,
              currentStockTP,
              editableDP: currentDP,
              editableTP: currentTP,
              total: validTransferQty * currentTP,
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
            TP: p.tp,
          }))
        : [
            {
              Barcode: "123456789",
              "Product Name": "Sample Product",
              "Transfer Quantity": "0",
              TP: "120.00",
            },
            {
              Barcode: "987654321",
              "Product Name": "Another Product",
              "Transfer Quantity": "0",
              TP: "180.00",
            },
          ];

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.sheet_add_aoa(
        ws,
        [
          ["IMPORTANT: Keep exact column names, edit only values"],
          ["1. Set 'Transfer Quantity' > 0 (0 is ignored)"],
          ["2. Quantity cannot exceed current stock"],
          ["3. TP optional – current price used if omitted"],
        ],
        { origin: -1 },
      );
      ws["!cols"] = [{ wch: 15 }, { wch: 40 }, { wch: 18 }, { wch: 10 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transfer Out");
      XLSX.writeFile(wb, "Transfer_Out_Template.xlsx");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate template");
    }
  };

  /* ------------------------------------------------------------------ */
  /* CART HELPERS */
  /* ------------------------------------------------------------------ */
  const updateTransferOutValue = (barcode, value) => {
    const qty = parseInt(value) || 0;
    setCart((prev) =>
      prev.map((i) =>
        i.barcode === barcode
          ? {
              ...i,
              transferOut: Math.min(qty, i.openingStock),
              total: Math.min(qty, i.openingStock) * i.editableTP,
            }
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
          total: i.transferOut * newVal,
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
    const transaction_id = uuidv4();

    try {
      const requests = cart.map(async (item) => {
        await axios.put("http://175.29.181.245:15001/update-outlet-stock", {
          barcode: item.barcode,
          outlet: user.outlet,
          newStock: item.openingStock - item.transferOut,
          currentStockValueDP:
            item.currentStockDP - item.transferOut * item.editableDP,
          currentStockValueTP:
            item.currentStockTP - item.transferOut * item.editableTP,
        });

        await axios.post("http://175.29.181.245:15001/stock-transactions", {
          barcode: item.barcode,
          outlet: user.outlet,
          type: "transfer out",
          quantity: item.transferOut,
          date: formatted,
          asm: user.asm,
          rsm: user.rsm,
          som: user.som,
          zone: user.zone,
          pricelabel: user.pricelabel,
          user: user.name,
          userID: user._id,
          dp: item.editableDP,
          tp: item.editableTP,
          transaction_id,
        });
      });

      await Promise.all(requests);
      toast.success("Transfer out processed!");
      getStockValue(user.outlet);
      setCart([]);
      setSearch("");
      setSearchResults([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to process transfer out");
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
            <p>Stock (DP): {stock.dp?.toFixed(2)}</p>
            <p>Stock (TP): {stock.tp?.toFixed(2)}</p>
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
              .reduce((s, i) => s + i.editableTP * i.transferOut, 0)
              .toFixed(2)}{" "}
            BDT
          </span>
          <span className="text-lg font-bold">
            Total Qty: {cart.reduce((s, i) => s + i.transferOut, 0)}
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
            <tr className="border-b bg-gray-200 text-xs">
              <th className="p-2 text-left w-1/4">Product</th>
              <th className="p-2 w-[50px] text-center">Stock</th>
              <th className="p-2 w-[100px] text-center">Price (TP)</th>
              <th className="p-2 w-[70px] text-center">Transfer Out</th>
              <th className="p-2 w-[40px] text-center"></th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item) => (
              <tr key={item.barcode} className="border-b text-xs">
                <td className="p-2 text-left break-words max-w-[100px] whitespace-normal">
                  {item.name}
                </td>
                <td className="p-2 text-center">{item.openingStock}</td>
                <td className="p-1 text-center">
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
                  />
                </td>
                <td className="p-1 text-center">
                  <input
                    type="number"
                    value={item.transferOut}
                    onChange={(e) =>
                      updateTransferOutValue(item.barcode, e.target.value)
                    }
                    className="border rounded px-1 py-0.5 text-center text-xs w-full max-w-[50px]"
                    min="0"
                    max={item.openingStock}
                  />
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

      {/* Submit */}
      <div className="flex justify-between items-center bg-white p-4 shadow rounded-lg">
        <span className="text-lg font-bold">
          Total: {cart.reduce((s, i) => s + i.total, 0).toFixed(2)} BDT
        </span>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center w-[140px] h-[40px]"
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
