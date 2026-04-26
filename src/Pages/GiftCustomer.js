import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

const GiftCustomers = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch users
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/gift-customer",
      );
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch customers");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle search and status filter
  const applyFilters = (searchValue, statusValue, usersData) => {
    let filtered = usersData;

    // Apply search filter
    if (searchValue) {
      filtered = filtered.filter((u) =>
        u.phone.toLowerCase().includes(searchValue.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusValue !== "All") {
      filtered = filtered.filter(
        (u) => (u.status || "Pending") === statusValue,
      );
    }

    setFilteredUsers(filtered);
  };

  // Handle search input change
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    applyFilters(value, statusFilter, users);
  };

  // Handle status filter change
  const handleStatusFilter = (e) => {
    const value = e.target.value;
    setStatusFilter(value);
    applyFilters(search, value, users);
  };

  // Update user status
  const updateStatus = async (id, status) => {
    try {
      await axios.put(`http://175.29.181.245:15001/gift-customer/${id}`, {
        status,
      });
      toast.success("Status updated successfully");
      await fetchUsers();
      applyFilters(search, statusFilter, users);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const dataToExport = filteredUsers.map((user) => ({
      Name: user.name,
      Phone: user.phone,
      Status: user.status || "Pending",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GiftCustomers");
    XLSX.writeFile(
      workbook,
      `GiftCustomers_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="p-2 w-full max-w-6xl mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Flormar Gift Campaign
      </h2>

      {/* Filters and Export */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search by phone number..."
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg
                className="animate-spin h-5 w-5 text-blue-500"
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
            </div>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={handleStatusFilter}
          className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Received">Received</option>
        </select>
        <button
          onClick={exportToExcel}
          className="p-3 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
        >
          Export to Excel
        </button>
      </div>

      {/* User Table */}
      <div className="bg-white shadow-lg rounded-lg">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
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
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            No customers found
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            {/* Desktop Table */}
            <table className="w-full text-sm border-collapse hidden sm:table">
              <thead>
                <tr className="border-b bg-gray-100 text-xs font-semibold text-gray-700">
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b hover:bg-gray-50 transition duration-150"
                  >
                    <td className="p-3 text-gray-800">{user.name}</td>
                    <td className="p-3 text-gray-800">{user.phone}</td>
                    <td className="p-3">
                      <select
                        value={user.status || "Pending"}
                        onChange={(e) => updateStatus(user._id, e.target.value)}
                        className={`w-full px-2 py-1 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ${
                          user.status === "Received"
                            ? "bg-green-100 text-green-800 border border-green-300"
                            : "bg-gray-100 text-gray-800 border border-gray-300"
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Received">Received</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card Layout */}
            <div className="sm:hidden space-y-4 p-4">
              {filteredUsers.map((user) => (
                <div
                  key={user._id}
                  className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition duration-150"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-800">
                      Name
                    </span>
                    <span className="text-sm text-gray-600">{user.name}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-semibold text-gray-800">
                      Phone
                    </span>
                    <span className="text-sm text-gray-600">{user.phone}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-semibold text-gray-800">
                      Status
                    </span>
                    <select
                      value={user.status || "Pending"}
                      onChange={(e) => updateStatus(user._id, e.target.value)}
                      className={`w-32 px-2 py-1 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ${
                        user.status === "Received"
                          ? "bg-green-100 text-green-800 border border-green-300"
                          : "bg-gray-100 text-gray-800 border border-gray-300"
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Received">Received</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GiftCustomers;
