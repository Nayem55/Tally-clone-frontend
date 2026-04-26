import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";

export default function PaymentRequests({ user }) {
  // Assuming user prop for auth/context if needed
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [startDate, setStartDate] = useState(
    dayjs().startOf("month").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(
    dayjs().endOf("month").format("YYYY-MM-DD"),
  );
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [startDate, endDate, selectedStatus]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("startDate", startDate);
      params.append("endDate", endDate);
      if (selectedStatus !== "All") {
        params.append("status", selectedStatus);
      }
      const res = await axios.get(
        `http://175.29.181.245:15001/payment-requests?${params.toString()}`,
      );
      setRequests(res.data.requests);
    } catch (error) {
      toast.error("Failed to fetch payment requests");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: "confirm" }));
    try {
      await axios.put(
        `http://175.29.181.245:15001/payment-request/${id}/confirm`,
      );
      toast.success("Payment request confirmed successfully!");
      fetchRequests(); // Refresh list
    } catch (error) {
      toast.error("Failed to confirm payment request");
      console.error("Error:", error);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const handleReject = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: "reject" }));
    try {
      await axios.put(
        `http://175.29.181.245:15001/payment-request/${id}/reject`,
      );
      toast.success("Payment request rejected successfully!");
      fetchRequests(); // Refresh list
    } catch (error) {
      toast.error("Failed to reject payment request");
      console.error("Error:", error);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const openImageModal = (imageUrl) => {
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImageUrl(null);
  };

  if (loading) {
    return <div>Loading payment requests...</div>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 text-green-800">
          Payment Requests
        </h2>

        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="p-2 border border-gray-300 rounded"
            >
              <option value="All">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {requests.length === 0 ? (
          <p>No requests found.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">Outlet</th>
                <th className="p-2 text-left">Amount</th>
                <th className="p-2 text-left">Payment Mode</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Created By</th>
                <th className="p-2 text-left">Image</th>
                <th className="p-2 text-left">Remarks</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id} className="border-b">
                  <td className="p-2">{req.outlet}</td>
                  <td className="p-2">{req.amount.toFixed(2)}</td>
                  <td className="p-2">
                    {req.paymentMode}
                    {req.bank ? ` (${req.bank})` : ""}
                  </td>
                  <td className="p-2">{req.date}</td>
                  <td className="p-2">{req.createdBy}</td>
                  <td className="p-2">
                    {req.imageUrl ? (
                      <img
                        src={req.imageUrl}
                        alt="Proof"
                        className="h-16 w-16 object-cover rounded cursor-pointer"
                        onClick={() => openImageModal(req.imageUrl)}
                      />
                    ) : (
                      "No Image"
                    )}
                  </td>
                  <td className="p-2">{req.remarks || "N/A"}</td>
                  <td className="p-2 capitalize">{req.status}</td>
                  <td className="p-2">
                    {req.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleConfirm(req._id)}
                          className="bg-green-600 text-white px-2 py-1 rounded mr-2"
                          disabled={!!actionLoading[req._id]}
                        >
                          {actionLoading[req._id] === "confirm"
                            ? "Confirming..."
                            : "Confirm"}
                        </button>
                        <button
                          onClick={() => handleReject(req._id)}
                          className="bg-red-600 text-white px-2 py-1 rounded"
                          disabled={!!actionLoading[req._id]}
                        >
                          {actionLoading[req._id] === "reject"
                            ? "Rejecting..."
                            : "Reject"}
                        </button>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Image Modal */}
      {isImageModalOpen && selectedImageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={selectedImageUrl}
              alt="Payment Proof"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
