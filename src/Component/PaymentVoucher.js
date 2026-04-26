import { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

export default function PaymentVoucher({
  user,
  currentDue,
  stock,
  setStock,
  getStockValue,
}) {
  const [formData, setFormData] = useState({
    amount: "",
    paymentMode: "cash",
    bank: "",
    remarks: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false); // New state for image upload loading
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const CLOUDINARY_URL =
    "https://api.cloudinary.com/v1_1/dodxop7lz/image/upload";
  const UPLOAD_PRESET = "Warehouse";

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    setImage(file);

    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      setImageUploading(true); // Start image upload loading
      try {
        const res = await axios.post(CLOUDINARY_URL, formData);
        setImageUrl(res.data.secure_url);
        toast.success("Image uploaded successfully");
      } catch (error) {
        toast.error("Image upload failed");
        console.error("Cloudinary Upload Error:", error);
      } finally {
        setImageUploading(false); // End image upload loading
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formattedDateTime = dayjs(formData.date).format(
      "YYYY-MM-DD HH:mm:ss",
    );

    try {
      await axios.post("http://175.29.181.245:15001/payment-request", {
        outlet: user.outlet,
        userId: user._id,
        SO: user.name,
        amount: parseFloat(formData.amount),
        asm: user.asm,
        rsm: user.rsm,
        zone: user.zone,
        type: "payment",
        paymentMode: formData.paymentMode,
        bank: formData.bank || "",
        date: formattedDateTime,
        createdBy: user.name,
        imageUrl,
        remarks: formData.remarks,
        status: "pending",
      });

      toast.success("Payment request submitted successfully!");
      getStockValue(user.outlet);
      setFormData({
        amount: "",
        paymentMode: "cash",
        bank: "",
        remarks: "",
        date: new Date().toISOString().split("T")[0],
      });
      setImageUrl("");
      setImage(null);
    } catch (error) {
      toast.error("Failed to submit payment request");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md min-h-screen">
      <h2 className="text-xl font-bold mb-4 text-green-800">Payment Voucher</h2>
      {/* <div className="mb-4 p-3 bg-green-50 rounded">
        <p className="font-semibold">Current Due: {currentDue?.toFixed(2)}</p>
      </div> */}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Enter amount"
              step="0.01"
              min="0"
              // max={currentDue}
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Payment Mode</label>
          <select
            name="paymentMode"
            value={formData.paymentMode}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>

        {formData.paymentMode === "bank" && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Select Bank
            </label>
            <select
              name="bank"
              value={formData.bank}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            >
              <option value="">Select Bank</option>
              <option value="city_bank">City Bank</option>
              <option value="brac_bank">BRAC Bank</option>
              <option value="dbbl">DBBL</option>
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Upload Proof Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full p-2 border border-gray-300 rounded"
            disabled={imageUploading}
          />
          {imageUploading ? (
            <div className="mt-2 flex items-center">
              <svg
                className="animate-spin h-5 w-5 text-green-600 mr-2"
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
                  d="M4 12a8 8 0 018-8v8z"
                ></path>
              </svg>
              <span>Uploading image...</span>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Preview"
              className="mt-2 h-24 rounded border object-cover"
            />
          ) : null}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
            rows="3"
            placeholder="Enter remarks (optional)"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200 flex justify-center items-center"
          disabled={
            loading ||
            imageUploading || // Disable when image is uploading
            (formData.paymentMode === "bank" && !formData.bank)
          }
        >
          {loading ? (
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
                d="M4 12a8 8 0 018-8v8z"
              ></path>
            </svg>
          ) : (
            "Submit Payment Request"
          )}
        </button>
      </form>
    </div>
  );
}
