import { useState, useEffect } from "react";
import dayjs from "dayjs";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function PosVoucher({ stock, setStock }) {
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState("name");
  const [cart, setCart] = useState(
    () => JSON.parse(localStorage.getItem("cart")) || [],
  );
  const [route, setRoute] = useState("");
  const [menu, setMenu] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    dayjs().format("YYYY-MM-DD"),
  );
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("pos-user"));

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const isPromoValid = (product) => {
    if (!product.promoStartDate || !product.promoEndDate) return false;

    const today = dayjs();
    const startDate = dayjs(product.promoStartDate);
    const endDate = dayjs(product.promoEndDate);

    return today.isAfter(startDate) && today.isBefore(endDate);
  };

  const getCurrentTP = (product) => {
    return isPromoValid(product) ? product.promoTP : product.tp;
  };

  const getCurrentDP = (product) => {
    return isPromoValid(product) ? product.promoDP : product.dp;
  };

  const handleSearch = async (query) => {
    if (query.length > 2) {
      setIsLoading(true);
      try {
        const response = await axios.get(
          "http://175.29.181.245:15001/search-product",
          {
            params: { search: query, type: searchType },
          },
        );
        setSearchResults(response.data);
      } catch (error) {
        console.error("Error fetching search results:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const addToCart = async (product) => {
    try {
      const stockResponse = await axios.get(
        "http://175.29.181.245:15001/outlet-stock",
        {
          params: { barcode: product.barcode, outlet: user.outlet },
        },
      );
      const outletStock = stockResponse.data.stock;

      if (outletStock === 0) {
        toast.error(`${product.name} is out of stock!`);
        return;
      }

      const currentTP = getCurrentTP(product);
      const currentDP = getCurrentDP(product);

      const productWithStock = {
        ...product,
        stock: outletStock,
        currentTP: currentTP,
        currentDP: currentDP,
        editableTP: currentTP,
        editableDP: currentDP,
      };

      const existingItem = cart.find(
        (item) => item._id === productWithStock._id,
      );

      if (existingItem) {
        if (existingItem.pcs < outletStock) {
          setCart(
            cart.map((item) =>
              item._id === productWithStock._id
                ? {
                    ...item,
                    pcs: item.pcs + 1,
                    total: (item.pcs + 1) * parseFloat(item.editableTP),
                  }
                : item,
            ),
          );
        } else {
          toast.error(
            `Cannot add more ${product.name}. Only ${outletStock} left.`,
          );
        }
      } else {
        setCart([
          ...cart,
          {
            ...productWithStock,
            pcs: 1,
            total: parseFloat(currentTP),
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching outlet stock:", error);
    }
    setSearch("");
    setSearchResults([]);
  };

  const updateQuantity = (id, change) => {
    setCart(
      cart.map((item) =>
        item._id === id
          ? {
              ...item,
              pcs: Math.max(1, Math.min(item.pcs + change, item.stock)),
              total:
                Math.max(1, Math.min(item.pcs + change, item.stock)) *
                item.editableTP,
            }
          : item,
      ),
    );
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item._id !== id));
  };

  const handlePriceChange = (id, field, value) => {
    setCart(
      cart.map((item) => {
        if (item._id === id) {
          const newValue = parseFloat(value) || 0;
          return {
            ...item,
            [field]: newValue,
            total: field === "editableTP" ? newValue * item.pcs : item.total,
          };
        }
        return item;
      }),
    );
  };

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomer((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("No item selected");
      return;
    }
    try {
      setIsSubmitting(true);

      const saleEntry = {
        user: user._id,
        outlet: user.outlet,
        route: route,
        memo: menu,
        sale_date: dayjs(selectedDate).format("YYYY-MM-DD HH:mm:ss"),
        total_tp: cart.reduce(
          (sum, item) => sum + item.editableTP * item.pcs,
          0,
        ),
        total_mrp: cart.reduce((sum, item) => sum + item.mrp * item.pcs, 0),
        total_dp: cart.reduce(
          (sum, item) => sum + item.editableDP * item.pcs,
          0,
        ),
        customer: customer,
        products: cart.map((item) => ({
          product_name: item.name,
          category: item.category,
          barcode: item.barcode,
          quantity: item.pcs,
          tp: item.editableTP * item.pcs,
          mrp: item.mrp * item.pcs,
          dp: item.editableDP * item.pcs,
        })),
      };

      await axios.post(
        "http://175.29.181.245:15001/add-sale-report",
        saleEntry,
      );

      const updatePromises = cart.map(async (item) => {
        await axios.post("http://175.29.181.245:15001/stock-transactions", {
          barcode: item.barcode,
          outlet: user.outlet,
          type: "secondary",
          asm: user.asm,
          rsm: user.rsm,
          zone: user.zone,
          quantity: item.pcs,
          date: dayjs(selectedDate).format("YYYY-MM-DD HH:mm:ss"),
          user: user.name,
          dp: item.editableDP,
          tp: item.editableTP,
        });
      });

      await Promise.all(updatePromises);

      const totalSold = cart.reduce((sum, item) => sum + item.pcs, 0);
      setStock((prevStock) => Math.max(0, prevStock - totalSold));

      setCart([]);
      localStorage.removeItem("cart");
      setCustomer({ name: "", phone: "", address: "" });
      toast.success("Sales report submitted");
    } catch (error) {
      console.error("Error updating outlet stock:", error);
      toast.error("Failed to submit sales report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 w-full max-w-md mx-auto bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white p-4 rounded-lg shadow mb-4">
        <h1 className="text-xl font-bold text-center">POS Voucher</h1>
        <div className="flex justify-between items-center mt-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm bg-white-500 text-black border-green-400 border rounded p-1"
          />
          {user && user.outlet && (
            <span className="text-sm font-semibold">
              <p>Stock (DP): {stock.dp?.toFixed(2)}</p>
              <p>Stock (TP): {stock.tp?.toFixed(2)}</p>
            </span>
          )}
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-white p-4 rounded-lg shadow mb-4 border border-green-100">
        <h2 className="text-md font-semibold text-green-700 mb-2">
          Customer Information
        </h2>
        <div className="space-y-2">
          <input
            type="text"
            name="name"
            value={customer.name}
            onChange={handleCustomerChange}
            placeholder="Customer Name"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <input
            type="tel"
            name="phone"
            value={customer.phone}
            onChange={handleCustomerChange}
            placeholder="Phone Number"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <textarea
            name="address"
            value={customer.address}
            onChange={handleCustomerChange}
            placeholder="Address"
            rows={2}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>

      {/* Route & Menu Inputs */}
      {/* <div className="bg-white p-4 rounded-lg shadow mb-4 border border-green-100">
        <div className="flex justify-between gap-4">
          <input
            onChange={(e) => setRoute(e.target.value)}
            name="route"
            type="text"
            placeholder="Route name"
            className="w-[50%] p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <input
            onChange={(e) => setMenu(e.target.value)}
            name="memo"
            type="number"
            placeholder="Memo count"
            className="w-[50%] p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div> */}

      {/* Search Box */}
      <div className="relative mb-4">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleSearch(e.target.value);
            }}
            placeholder="Search product..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="name">Name</option>
            <option value="barcode">Barcode</option>
          </select>
        </div>
        {search && (
          <ul className="absolute z-10 bg-white w-full border border-gray-300 rounded-lg mt-1 shadow-lg max-h-60 overflow-auto">
            {isLoading ? (
              <li className="p-3 text-center text-gray-500">Loading...</li>
            ) : searchResults.length > 0 ? (
              searchResults.map((p) => (
                <li
                  key={p._id}
                  onClick={() => addToCart(p)}
                  className="p-3 cursor-pointer hover:bg-green-50 border-b border-gray-100 last:border-0 flex justify-between items-center"
                >
                  <span>
                    {p.name}{" "}
                    {isPromoValid(p) && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded ml-2">
                        PROMO
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-gray-600">{p.barcode}</span>
                </li>
              ))
            ) : (
              <li className="p-3 text-center text-gray-500">
                No products found
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow mb-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="p-3 text-left w-1/3">Product</th>
                <th className="p-3 w-[70px] text-center">Qty</th>
                <th className="p-3 w-[100px] text-center">Price</th>
                <th className="p-3 w-[70px] text-center">Total</th>
                <th className="p-3 w-[40px] text-center"></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr
                  key={item._id}
                  className="border-b border-gray-200 hover:bg-green-50"
                >
                  {/* Product Name */}
                  <td className="p-3 text-left max-w-[120px]">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      Stock: {item.stock}
                    </div>
                  </td>

                  {/* Quantity Controls */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item._id, -1)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded h-6 w-6 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="text-sm w-6 text-center">
                          {item.pcs}
                        </span>
                        <button
                          onClick={() => updateQuantity(item._id, 1)}
                          className="bg-green-100 hover:bg-green-200 text-green-800 rounded h-6 w-6 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Editable Prices */}
                  <td className="p-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <input
                        type="number"
                        value={item.editableDP}
                        onChange={(e) =>
                          handlePriceChange(
                            item._id,
                            "editableDP",
                            e.target.value,
                          )
                        }
                        className="border border-gray-300 rounded px-1 py-1 text-center text-xs w-full max-w-[80px] focus:ring-1 focus:ring-green-500"
                      />
                      <input
                        type="number"
                        value={item.editableTP}
                        onChange={(e) =>
                          handlePriceChange(
                            item._id,
                            "editableTP",
                            e.target.value,
                          )
                        }
                        className="border border-gray-300 rounded px-1 py-1 text-center text-xs w-full max-w-[80px] focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  </td>

                  {/* Total */}
                  <td className="p-3 text-center font-medium">
                    {(item.editableTP * item.pcs).toFixed(2)}
                  </td>

                  {/* Delete Button */}
                  <td className="text-center">
                    <button
                      onClick={() => removeFromCart(item._id)}
                      className="text-red-500 hover:text-red-700"
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
      </div>

      {/* Summary and Submit */}
      <div className="bg-white p-4 rounded-lg shadow border border-green-100">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-bold text-gray-800">Total Items:</span>
          <span className="text-lg font-bold">
            {cart.reduce((sum, item) => sum + item.pcs, 0)}
          </span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-bold text-gray-800">
            Total Amount (TP):
          </span>
          <span className="text-xl font-bold text-green-600">
            {cart
              .reduce((sum, item) => sum + item.editableTP * item.pcs, 0)
              .toFixed(2)}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center transition-colors duration-200"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white mr-2"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            "Submit Sale"
          )}
        </button>
      </div>
    </div>
  );
}
