import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { FiSearch, FiPlus, FiTrash2, FiCalendar } from "react-icons/fi";

export default function PrimaryRequest() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const user = JSON.parse(localStorage.getItem("pos-user"));

  const handleSearch = async (query) => {
    setSearch(query);
    if (query.length > 2) {
      setIsSearching(true);
      try {
        const res = await axios.get(
          "http://175.29.181.245:15001/search-product",
          {
            params: { search: query, type: "name" },
          },
        );
        setResults(res.data);
      } catch (err) {
        console.error(err);
        // toast.error("Search failed");
      } finally {
        setIsSearching(false);
      }
    } else {
      setResults([]);
    }
  };

  const addToCart = (product) => {
    const alreadyInCart = cart.find((item) => item.barcode === product.barcode);
    if (alreadyInCart) {
      toast.error("Product already in request");
      return;
    }
    setCart([...cart, { ...product, quantity: 1 }]);
    setSearch("");
    setResults([]);
  };

  const updateQuantity = (barcode, quantity) => {
    setCart((prev) =>
      prev.map((item) =>
        item.barcode === barcode
          ? { ...item, quantity: parseInt(quantity) || 0 }
          : item,
      ),
    );
  };

  const removeFromCart = (barcode) => {
    setCart((prev) => prev.filter((item) => item.barcode !== barcode));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return toast.error("No products added");
    if (cart.some((item) => item.quantity <= 0))
      return toast.error("All quantities must be greater than 0");

    const order = {
      userId: user?._id,
      name: user.name,
      outlet: user.outlet,
      zone: user.zone,
      group: user.group,
      date,
      items: cart.map((item) => ({
        barcode: item.barcode,
        name: item.name,
        dp: parseInt(item.dp),
        tp: parseInt(item.tp),
        qty: item.quantity,
      })),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    try {
      setIsSubmitting(true);
      await axios.post("http://175.29.181.245:15001/primary-request", order);
      toast.success("Request submitted successfully!");
      setCart([]);
    } catch (err) {
      console.error(err);
      toast.error("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  // const totalValue = cart.reduce(
  //   (sum, item) => sum + item.quantity * parseInt(item.tp),
  //   0
  // );

  return (
    <div className="p-4 w-full max-w-md mx-auto bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between bg-white p-4 shadow rounded-lg mb-4 items-center">
        <h1 className="text-lg font-bold">Request Primary</h1>
        <div className="flex items-center gap-2">
          <FiCalendar className="text-gray-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border rounded p-1"
          />
        </div>
      </div>

      {/* Search Box */}
      <div className="relative mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleSearch(e.target.value);
            }}
            placeholder="Search product..."
            className="w-full pl-10 p-2 border rounded-lg"
          />
        </div>
        {search && (
          <ul className="absolute bg-white w-full border rounded-lg mt-1 shadow max-h-60 overflow-y-auto z-10">
            {isSearching ? (
              <li className="p-2 text-center text-gray-500">Searching...</li>
            ) : results.length > 0 ? (
              results.map((p) => (
                <li
                  key={p?._id}
                  onClick={() => addToCart(p)}
                  className="p-2 cursor-pointer hover:bg-gray-100 flex justify-between items-center"
                >
                  <span className="truncate">{p.name}</span>
                  <FiPlus className="text-blue-500" />
                </li>
              ))
            ) : (
              <li className="p-2 text-center text-gray-500">
                No results found
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Request Items */}
      {cart.length > 0 ? (
        <div className="bg-white p-4 shadow rounded-lg mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold">Request Items</h2>
            <span className="text-sm text-gray-600">{totalItems} items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-center">Qty</th>
                  {/* <th className="p-2 text-center">TP</th> */}
                  <th className="p-2 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.barcode} className="border-b">
                    <td className="p-2">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.barcode}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.barcode, e.target.value)
                        }
                        className="w-16 border rounded px-1 py-0.5 text-center"
                      />
                    </td>
                    {/* <td className="p-2 text-center">
                      {parseInt(item.tp)?.toFixed(2)}
                    </td> */}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => removeFromCart(item.barcode)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 text-center rounded-lg shadow">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-3">
            <FiPlus className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            No products added
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Search for products above to add them to your request
          </p>
        </div>
      )}

      {/* Submit Button */}
      {cart.length > 0 && (
        <div className="bg-white p-4 shadow rounded-lg">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              "Submit Request"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
