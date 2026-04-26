import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const TadaVoucher = () => {
  const user = JSON.parse(localStorage.getItem("pos-user"));
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    dayjs().format("YYYY-MM-DD"),
  );

  // Daily expense data structure
  const [dailyExpense, setDailyExpense] = useState({
    from: "",
    to: "",
    hqExHq: { hq: 0, exHq: 0 },
    transport: { bus: 0, cng: 0, train: 0, other: 0 },
    hotelBill: 0,
    totalExpense: 0,
  });

  // Checkbox states
  const [hqExHqChecked, setHqExHqChecked] = useState({
    hq: false,
    exHq: false,
  });
  const [transportChecked, setTransportChecked] = useState({
    bus: false,
    cng: false,
    train: false,
    other: false,
  });

  // Transport options
  const transportOptions = [
    { value: "bus", label: "Bus" },
    { value: "cng", label: "CNG" },
    { value: "train", label: "Train" },
    { value: "other", label: "Other" },
  ];

  // Check authentication
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  // Handle input changes for text fields
  const handleInputChange = (field, value) => {
    setDailyExpense((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle checkbox toggle for HQ/Ex-HQ
  const toggleHqExHq = (type) => {
    setHqExHqChecked((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
    setDailyExpense((prev) => ({
      ...prev,
      hqExHq: {
        ...prev.hqExHq,
        [type]:
          prev.hqExHq[type] && !hqExHqChecked[type] ? 0 : prev.hqExHq[type],
      },
    }));
  };

  // Handle amount change for HQ/Ex-HQ
  const handleHqExHqAmountChange = (type, value) => {
    setDailyExpense((prev) => ({
      ...prev,
      hqExHq: {
        ...prev.hqExHq,
        [type]: value === "" ? 0 : parseFloat(value) || 0,
      },
    }));
  };

  // Handle checkbox toggle for transport
  const toggleTransport = (type) => {
    setTransportChecked((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
    setDailyExpense((prev) => ({
      ...prev,
      transport: {
        ...prev.transport,
        [type]:
          prev.transport[type] && !transportChecked[type]
            ? 0
            : prev.transport[type],
      },
    }));
  };

  // Handle amount change for transport
  const handleTransportAmountChange = (type, value) => {
    setDailyExpense((prev) => ({
      ...prev,
      transport: {
        ...prev.transport,
        [type]: value === "" ? 0 : parseFloat(value) || 0,
      },
    }));
  };

  // Calculate total expense
  const calculateTotal = () => {
    const transportTotal = Object.values(dailyExpense.transport)
      .map((amount) => parseFloat(amount) || 0)
      .reduce((sum, amount) => sum + amount, 0);
    const hqExHqTotal = Object.values(dailyExpense.hqExHq)
      .map((amount) => parseFloat(amount) || 0)
      .reduce((sum, amount) => sum + amount, 0);
    const hotel = parseFloat(dailyExpense.hotelBill) || 0;
    const total = transportTotal + hqExHqTotal + hotel;

    setDailyExpense((prev) => ({
      ...prev,
      totalExpense: total.toFixed(2),
    }));

    return total;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Calculate total before submission
    calculateTotal();

    // Validation
    if (!dailyExpense.from || !dailyExpense.to) {
      toast.error("Please fill in visited places");
      return;
    }

    const hasExpenses =
      Object.values(dailyExpense.hqExHq).some(
        (amount) => parseFloat(amount) > 0,
      ) ||
      Object.values(dailyExpense.transport).some(
        (amount) => parseFloat(amount) > 0,
      ) ||
      parseFloat(dailyExpense.hotelBill) > 0;

    if (!hasExpenses) {
      toast.error(
        "Please provide at least one expense amount (HQ/Ex-HQ, Transport, or Hotel)",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare submission data
      const submissionData = {
        userId: user._id,
        name: user.name,
        designation: user.role,
        area: user.zone,
        date: selectedDate,
        month: dayjs(selectedDate).format("YYYY-MM"),
        dailyExpense: {
          from: dailyExpense.from,
          to: dailyExpense.to,
          hqExHq: {
            hq: parseFloat(dailyExpense.hqExHq.hq) || 0,
            exHq: parseFloat(dailyExpense.hqExHq.exHq) || 0,
          },
          transport: {
            bus: parseFloat(dailyExpense.transport.bus) || 0,
            cng: parseFloat(dailyExpense.transport.cng) || 0,
            train: parseFloat(dailyExpense.transport.train) || 0,
            other: parseFloat(dailyExpense.transport.other) || 0,
          },
          hotelBill: parseFloat(dailyExpense.hotelBill) || 0,
          totalExpense: parseFloat(dailyExpense.totalExpense) || 0,
        },
      };

      const response = await fetch("http://175.29.181.245:15001/tdda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit TD/DA voucher");
      }

      // Reset form after successful submission
      setDailyExpense({
        from: "",
        to: "",
        hqExHq: { hq: 0, exHq: 0 },
        transport: { bus: 0, cng: 0, train: 0, other: 0 },
        hotelBill: 0,
        totalExpense: 0,
      });
      setHqExHqChecked({ hq: false, exHq: false });
      setTransportChecked({
        bus: false,
        cng: false,
        train: false,
        other: false,
      });

      toast.success("TD/DA voucher submitted successfully!");
    } catch (error) {
      console.error("Error submitting TD/DA voucher:", error);
      toast.error(
        error.message || "Failed to submit voucher. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 w-full max-w-md mx-auto bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg shadow-lg mb-6">
        <h1 className="text-xl font-bold text-center">TD/DA Voucher</h1>
        <div className="flex flex-col space-y-3 mt-3">
          <div className="flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 text-sm bg-white text-gray-800 border rounded p-2"
              aria-label="Select date"
            />
          </div>
        </div>
      </div>

      {/* Voucher Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Visited Places */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-blue-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            Visited Places
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From
              </label>
              <input
                type="text"
                value={dailyExpense.from}
                onChange={(e) => handleInputChange("from", e.target.value)}
                placeholder="Starting location"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
                aria-label="Starting location"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To
              </label>
              <input
                type="text"
                value={dailyExpense.to}
                onChange={(e) => handleInputChange("to", e.target.value)}
                placeholder="Destination"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
                aria-label="Destination"
              />
            </div>
          </div>
        </div>

        {/* HQ/Ex-HQ Expenses */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-blue-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
            HQ/Ex-HQ Expenses
          </h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={hqExHqChecked.hq}
                  onChange={() => toggleHqExHq("hq")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  aria-label="HQ expense"
                />
                <span className="ml-2 text-sm text-gray-700">HQ</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={hqExHqChecked.exHq}
                  onChange={() => toggleHqExHq("exHq")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  aria-label="Ex-HQ expense"
                />
                <span className="ml-2 text-sm text-gray-700">Ex-HQ</span>
              </label>
            </div>
            {hqExHqChecked.hq && (
              <div className="transition-all duration-300">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HQ Amount (৳)
                </label>
                <input
                  type="number"
                  value={
                    dailyExpense.hqExHq.hq === 0 ? "" : dailyExpense.hqExHq.hq
                  }
                  onChange={(e) =>
                    handleHqExHqAmountChange("hq", e.target.value)
                  }
                  onBlur={calculateTotal}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter HQ amount"
                  min="0"
                  aria-label="HQ amount"
                />
              </div>
            )}
            {hqExHqChecked.exHq && (
              <div className="transition-all duration-300">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ex-HQ Amount (৳)
                </label>
                <input
                  type="number"
                  value={
                    dailyExpense.hqExHq.exHq === 0
                      ? ""
                      : dailyExpense.hqExHq.exHq
                  }
                  onChange={(e) =>
                    handleHqExHqAmountChange("exHq", e.target.value)
                  }
                  onBlur={calculateTotal}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter Ex-HQ amount"
                  min="0"
                  aria-label="Ex-HQ amount"
                />
              </div>
            )}
          </div>
        </div>

        {/* Transport Expenses */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-blue-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h.5a1.5 1.5 0 001.5-1.5V6.621c0-.418-.105-.83-.305-1.197l-1.11-1.999A1.5 1.5 0 0010.5 3H13V1.5a.5.5 0 011 0V3h1.5a.5.5 0 010 1H14v8.5a.5.5 0 00.5.5h.5a1 1 0 001-1V5a1 1 0 00-1-1h-3.5a.5.5 0 01-.447-.276L11 3.5H9.553l-.276.553A.5.5 0 019 4H3z" />
            </svg>
            Transport Expenses
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              {transportOptions.map((option) => (
                <label key={option.value} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={transportChecked[option.value]}
                    onChange={() => toggleTransport(option.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    aria-label={`${option.label} transport`}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-3">
              {transportOptions.map(
                (option) =>
                  transportChecked[option.value] && (
                    <div
                      key={option.value}
                      className="transition-all duration-300"
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {option.label} Amount (৳)
                      </label>
                      <input
                        type="number"
                        value={
                          dailyExpense.transport[option.value] === 0
                            ? ""
                            : dailyExpense.transport[option.value]
                        }
                        onChange={(e) =>
                          handleTransportAmountChange(
                            option.value,
                            e.target.value,
                          )
                        }
                        onBlur={calculateTotal}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder={`Enter ${option.label} amount`}
                        min="0"
                        aria-label={`${option.label} amount`}
                      />
                    </div>
                  ),
              )}
            </div>
          </div>
        </div>

        {/* Other Expenses */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-blue-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            Other Expenses
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hotel Bill (৳)
              </label>
              <input
                type="number"
                value={
                  dailyExpense.hotelBill === 0 ? "" : dailyExpense.hotelBill
                }
                onChange={(e) =>
                  handleInputChange(
                    "hotelBill",
                    e.target.value === "" ? 0 : parseFloat(e.target.value),
                  )
                }
                onBlur={calculateTotal}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter amount"
                min="0"
                aria-label="Hotel bill amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Expense (৳)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={dailyExpense.totalExpense || "0.00"}
                  readOnly
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 font-medium text-gray-700"
                  aria-label="Total expense"
                />
                <span className="absolute right-3 top-2 text-gray-500">৳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center transition-colors duration-200 shadow-md"
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
              Submitting...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Submit Voucher
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default TadaVoucher;
