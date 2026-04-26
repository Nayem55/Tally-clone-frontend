import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import AdminSidebar from "../../Component/AdminSidebar";
import OpeningStock from "../OpeningStock";
import Primary from "../Primary";
import Secondary from "../Secondary";
import OfficeReturn from "../OfficeReturn";
import MarketReturn from "../MarketReturn";
import toast from "react-hot-toast";
import AdjustmentVoucher from "../Adjustment";
import TransferIn from "../TransferIn";
import TransferOut from "../TransferOut";

const ManageStock = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTab, setSelectedTab] = useState("");
  const [stock, setStock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [currentDue, setCurrentDue] = useState(0);
  const [userSearch, setUserSearch] = useState(""); // State for user search query
  const [showUserDropdown, setShowUserDropdown] = useState(false); // State for user dropdown visibility
  const userDropdownRef = useRef(null); // Ref for handling click outside

  useEffect(() => {
    fetchUsers();
    fetchAllProducts();
  }, []);

  // Handle click outside to close user dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target)
      ) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://175.29.181.245:15001/getAllUser",
      );
      setUsers(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
    }
  };

  const fetchAllProducts = async () => {
    try {
      setProductsLoading(true);
      const response = await axios.get(
        "http://175.29.181.245:15001/all-products",
      );
      setProducts(response.data);
      setProductsLoading(false);
    } catch (error) {
      console.error("Error fetching products:", error);
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUser && selectedUser.outlet) {
      getStockValue(selectedUser.outlet);
    }
  }, [selectedUser]);

  const getStockValue = async (outletName) => {
    try {
      const encodedOutletName = encodeURIComponent(outletName);
      const [stockResponse, dueResponse] = await Promise.all([
        axios.get(
          `http://175.29.181.245:15001/api/stock-value/${encodedOutletName}`,
        ),
        axios.get(
          `http://175.29.181.245:15001/current-due/${encodedOutletName}`,
        ),
      ]);
      console.log(
        "Stock Response:",
        stockResponse.data,
        "Due Response:",
        dueResponse.data,
      );
      setCurrentDue(dueResponse.data.current_due);
      setStock({
        dp: stockResponse.data.totalCurrentDP,
        tp: stockResponse.data.totalCurrentTP,
      });
    } catch (error) {
      console.error("Error fetching stock data:", error);
      // toast.error("Failed to load stock data.");
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter((user) =>
    `${user.outlet} ${user.name} ${user.role}`
      .toLowerCase()
      .includes(userSearch.toLowerCase()),
  );

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setUserSearch(`${user.outlet} (${user.name}) - ${user.role}`);
    setShowUserDropdown(false);
    setSelectedTab("");
  };

  const renderContent = () => {
    if (!selectedUser) {
      return (
        <div className="text-center text-red-500 font-medium mt-10">
          Please select a user to manage stock.
        </div>
      );
    }

    if (productsLoading) {
      return (
        <div className="text-center mt-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2">Loading products...</p>
        </div>
      );
    }

    const commonProps = {
      user: selectedUser,
      stock: stock,
      setStock: setStock,
      getStockValue: getStockValue,
      allProducts: products,
      currentDue: currentDue,
    };

    switch (selectedTab) {
      case "opening":
        return <OpeningStock {...commonProps} />;
      case "primary":
        return <Primary {...commonProps} />;
      case "secondary":
        return <Secondary {...commonProps} />;
      case "officeReturn":
        return <OfficeReturn {...commonProps} />;
      case "marketReturn":
        return <MarketReturn {...commonProps} />;
      case "TransferIn":
        return <TransferIn {...commonProps} />;
      case "TransferOut":
        return <TransferOut {...commonProps} />;
      case "adjust":
        return <AdjustmentVoucher {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-gray-800">Manage Stock</h1>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">
                Select User
              </label>
              <div className="relative w-full" ref={userDropdownRef}>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="Search User (Outlet, Name, Role)..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Search User"
                />
                {showUserDropdown && filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <div
                        key={user._id}
                        onClick={() => handleUserSelect(user)}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        role="option"
                        aria-selected={selectedUser?._id === user._id}
                      >
                        {user.outlet} ({user.name}) - {user.role}
                      </div>
                    ))}
                  </div>
                )}
                {showUserDropdown &&
                  userSearch &&
                  filteredUsers.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg px-4 py-2 text-sm text-gray-500">
                      No users found
                    </div>
                  )}
              </div>
            </div>

            {selectedUser && (
              <>
                <div className="mb-4 text-blue-600 font-semibold text-lg">
                  Total Stock Value (DP): {stock?.dp?.toFixed()}
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2">
                    Select Stock Operation
                  </label>
                  <select
                    value={selectedTab}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Choose Operation --</option>
                    <option value="opening">Opening Stock</option>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="officeReturn">Office Return</option>
                    <option value="marketReturn">Market Return</option>
                    <option value="TransferIn">Transfer In</option>
                    <option value="TransferOut">Transfer Out</option>
                    <option value="adjust">Due Adjustment</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {selectedTab && (
            <div className="bg-white p-6 rounded-xl shadow-md">
              {renderContent()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ManageStock;
