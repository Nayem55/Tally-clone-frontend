import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import axios from "axios";
import AdminSidebar from "../Component/AdminSidebar";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const FullSalesReport = () => {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [reportData, setReportData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedZone, setSelectedZone] = useState("");
  const [uniqueZones, setUniqueZones] = useState([]);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(
          "http://175.29.181.245:15001/getAlluser",
        );
        setAllUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users");
      }
    };
    fetchUsers();
  }, []);

  // Generate report
  const generateReport = async () => {
    try {
      setIsGenerating(true);
      const response = await axios.get(
        "http://175.29.181.245:15001/sales/full-report",
        {
          params: { month: selectedMonth },
        },
      );

      // Merge report data with all users to include non-submitters
      const reportUsers = response.data.users;
      const mergedUsers = allUsers.map((user) => {
        const reportUser = reportUsers.find((ru) => ru.userId === user._id);
        return reportUser
          ? { ...reportUser, hasReport: true }
          : {
              userId: user._id,
              name: user.name,
              zone: user.zone,
              outlet: user.outlet || "-",
              dailyTotals: Array(response.data.days.length).fill(0),
              total: 0,
              hasReport: false,
            };
      });

      setReportData({
        ...response.data,
        users: mergedUsers,
      });
      const zones = [...new Set(mergedUsers.map((u) => u.zone))].sort();
      setUniqueZones(zones);
      setSelectedZone("");
      toast.success("Full report generated successfully");
    } catch (error) {
      console.error("Error generating full report:", error);
      toast.error(error.response?.data?.error || "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered users based on zone
  const filteredUsers = reportData
    ? reportData.users.filter(
        (user) => !selectedZone || user.zone === selectedZone,
      )
    : [];

  // Calculate summary
  const calculateSummary = () => {
    if (!reportData || !filteredUsers.length) return null;

    const dailySums = reportData.days.map((_, index) =>
      filteredUsers.reduce((sum, user) => sum + user.dailyTotals[index], 0),
    );
    const grandTotal = dailySums.reduce((sum, v) => sum + v, 0);

    return {
      dailySums,
      grandTotal,
    };
  };

  const summary = calculateSummary();

  // Fetch detailed reports for a user
  const fetchUserReports = async (userId) => {
    try {
      const response = await axios.get(
        `http://175.29.181.245:15001/sales-reports/${userId}`,
        { params: { month: selectedMonth } },
      );
      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      console.error(`Error fetching reports for user ${userId}:`, error);
      return [];
    }
  };

  // Export to Excel (Detailed Report)
  const exportToExcel = async () => {
    if (!reportData || !filteredUsers.length) {
      toast.error("No data available to export");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const headers = ["Date", "Products Sold", "Route", "Memo", "Total TP"];
      const period = `Month: ${dayjs(selectedMonth).format("MMMM YYYY")}`;

      // Fetch detailed reports for all filtered users
      const userReports = await Promise.all(
        filteredUsers.map(async (user) => ({
          user,
          reports: await fetchUserReports(user.userId),
        })),
      );

      // Create a worksheet for each user
      userReports.forEach(({ user, reports }) => {
        if (!reports.length) return;

        const data = [
          [`${user.name}'s Sales Report`],
          [period],
          [`Zone: ${user.zone}`, `Outlet: ${user.outlet}`],
          [""],
          headers,
          ...reports.map((report) => [
            dayjs(report.sale_date).format("YYYY-MM-DD"),
            report.products
              .map((p) => `• ${p.product_name} x ${p.quantity}`)
              .join("\n"),
            report.route || "N/A",
            report.memo || "N/A",
            `৳${report.total_tp.toFixed(2)}`,
          ]),
          ["", "", "", "", "Summary"],
          [
            "Total",
            reports.reduce(
              (sum, r) =>
                sum + r.products.reduce((s, p) => s + (p.quantity || 0), 0),
              0,
            ),
            "",
            "",
            `৳${reports.reduce((sum, r) => sum + (r.total_tp || 0), 0).toFixed(2)}`,
          ],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);

        ws["!cols"] = [
          { wch: 15 }, // Date
          { wch: 60 }, // Products Sold
          { wch: 25 }, // Route
          { wch: 35 }, // Memo
          { wch: 15 }, // Total TP
        ];

        const borderStyle = {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        };

        const styles = {
          title: {
            font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1E3A8A" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: borderStyle,
          },
          info: {
            font: { bold: true, sz: 12, color: { rgb: "1F2937" } },
            border: borderStyle,
          },
          header: {
            font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1E3A8A" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: borderStyle,
          },
          dataEven: {
            font: { sz: 10 },
            alignment: {
              horizontal: "center",
              vertical: "center",
              wrapText: true,
            },
            border: borderStyle,
          },
          dataOdd: {
            font: { sz: 10 },
            fill: { fgColor: { rgb: "F3F4F6" } },
            alignment: {
              horizontal: "center",
              vertical: "center",
              wrapText: true,
            },
            border: borderStyle,
          },
          total: {
            font: { bold: true, sz: 11 },
            fill: { fgColor: { rgb: "FEF3C7" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: borderStyle,
          },
        };

        for (let i = 0; i < data.length; i++) {
          for (let j = 0; j < data[i].length; j++) {
            const cellAddress = XLSX.utils.encode_cell({ r: i, c: j });
            if (!ws[cellAddress]) continue;

            if (i === 0) {
              ws[cellAddress].s = styles.title;
            } else if (i === 1 || i === 2) {
              ws[cellAddress].s = styles.info;
            } else if (i === 4) {
              ws[cellAddress].s = styles.header;
            } else if (i >= 5 && i < data.length - 2) {
              ws[cellAddress].s =
                i % 2 === 0 ? styles.dataOdd : styles.dataEven;
            } else if (i >= data.length - 2) {
              ws[cellAddress].s = styles.total;
            } else {
              ws[cellAddress].s = { border: borderStyle };
            }
          }
        }

        ws["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
          { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
          {
            s: { r: data.length - 2, c: 0 },
            e: { r: data.length - 2, c: headers.length - 1 },
          },
          { s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 0 } },
        ];

        XLSX.utils.book_append_sheet(
          wb,
          ws,
          `${user.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
        );
      });

      const fileName = `Detailed_Sales_Report_${selectedMonth}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Detailed report exported to Excel successfully");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export detailed report");
    }
  };

  // Export to PDF (Detailed Report)
  const exportToPDF = async () => {
    if (!reportData || !filteredUsers.length) {
      toast.error("No data available to export");
      return;
    }

    try {
      const doc = new jsPDF();
      const period = `Month: ${dayjs(selectedMonth).format("MMMM YYYY")}`;
      let currentY = 15;

      // Fetch detailed reports for all filtered users
      const userReports = await Promise.all(
        filteredUsers.map(async (user) => ({
          user,
          reports: await fetchUserReports(user.userId),
        })),
      );

      userReports.forEach(({ user, reports }, index) => {
        if (!reports.length) return;

        if (index > 0) {
          doc.addPage();
          currentY = 15;
        }

        // Header
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 64, 175);
        doc.text(
          `${user.name}'s Sales Report`,
          doc.internal.pageSize.getWidth() / 2,
          currentY,
          {
            align: "center",
          },
        );

        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);
        doc.setFont("helvetica", "normal");
        doc.text(period, 14, currentY + 10);
        doc.text(
          `Zone: ${user.zone} | Outlet: ${user.outlet}`,
          14,
          currentY + 20,
        );

        // Table
        autoTable(doc, {
          startY: currentY + 30,
          margin: { left: 14, right: 14 },
          head: [["Date", "Products Sold", "Route", "Memo", "Total TP"]],
          body: reports.map((report) => [
            dayjs(report.sale_date).format("YYYY-MM-DD"),
            report.products
              .map((p) => `• ${p.product_name} x ${p.quantity}`)
              .join("\n"),
            report.route || "N/A",
            report.memo || "N/A",
            `${report.total_tp.toFixed(2)}`,
          ]),
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 11,
            halign: "center",
            valign: "middle",
            cellPadding: 3,
          },
          styles: {
            fontSize: 10,
            halign: "center",
            valign: "middle",
            cellPadding: 3,
            lineWidth: 0.1,
            lineColor: [55, 65, 81],
          },
          alternateRowStyles: {
            fillColor: [243, 244, 246],
          },
          columnStyles: {
            0: { cellWidth: 25, halign: "center" },
            1: { cellWidth: 70, halign: "left" },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 40, halign: "center" },
            4: { cellWidth: 20, halign: "center" },
          },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 1) {
              data.cell.styles.halign = "left";
            }
          },
        });

        // Summary
        currentY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Total Products Sold: ${reports.reduce(
            (sum, r) =>
              sum + r.products.reduce((s, p) => s + (p.quantity || 0), 0),
            0,
          )}`,
          14,
          currentY,
        );
        doc.text(
          `Total TP: ${reports.reduce((sum, r) => sum + (r.total_tp || 0), 0).toFixed(2)}`,
          14,
          currentY + 10,
        );
      });

      const fileName = `Detailed_Sales_Report_${selectedZone}.pdf`;
      doc.save(fileName);
      toast.success("Detailed report exported to PDF successfully");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("Failed to export detailed report");
    }
  };

  // Export All Reports (ZIP of PDFs)
  const exportAllReports = async () => {
    if (!reportData || !filteredUsers.length) {
      toast.error("No data available to export");
      return;
    }

    try {
      const zip = new JSZip();
      const headers = ["Date", "Products Sold", "Route", "Memo", "Total TP"];
      const period = `Month: ${dayjs(selectedMonth).format("MMMM YYYY")}`;

      // Fetch detailed reports for all filtered users
      const userReports = await Promise.all(
        filteredUsers.map(async (user) => ({
          user,
          reports: await fetchUserReports(user.userId),
        })),
      );

      await Promise.all(
        userReports.map(async ({ user, reports }) => {
          if (!reports.length) return;

          const doc = new jsPDF();
          let currentY = 15;

          // Header
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 64, 175);
          doc.text(
            `${user.name}'s Sales Report`,
            doc.internal.pageSize.getWidth() / 2,
            currentY,
            {
              align: "center",
            },
          );

          doc.setFontSize(12);
          doc.setTextColor(31, 41, 55);
          doc.setFont("helvetica", "normal");
          doc.text(period, 14, currentY + 10);
          doc.text(
            `Zone: ${user.zone} | Outlet: ${user.outlet}`,
            14,
            currentY + 20,
          );

          // Table
          autoTable(doc, {
            startY: currentY + 30,
            margin: { left: 14, right: 14 },
            head: [headers],
            body: reports.map((report) => [
              dayjs(report.sale_date).format("YYYY-MM-DD"),
              report.products
                .map((p) => `• ${p.product_name} x ${p.quantity}`)
                .join("\n"),
              report.route || "N/A",
              report.memo || "N/A",
              `${report.total_tp.toFixed(2)}`,
            ]),
            headStyles: {
              fillColor: [30, 64, 175],
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 11,
              halign: "center",
              valign: "middle",
              cellPadding: 3,
            },
            styles: {
              fontSize: 10,
              halign: "center",
              valign: "middle",
              cellPadding: 3,
              lineWidth: 0.1,
              lineColor: [55, 65, 81],
            },
            alternateRowStyles: {
              fillColor: [243, 244, 246],
            },
            columnStyles: {
              0: { cellWidth: 25, halign: "center" },
              1: { cellWidth: 70, halign: "left" },
              2: { cellWidth: 25, halign: "center" },
              3: { cellWidth: 40, halign: "center" },
              4: { cellWidth: 20, halign: "center" },
            },
            didParseCell: (data) => {
              if (data.section === "body" && data.column.index === 1) {
                data.cell.styles.halign = "left";
              }
            },
          });

          // Summary
          currentY = doc.lastAutoTable.finalY + 10;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(
            `Total Products Sold: ${reports.reduce(
              (sum, r) =>
                sum + r.products.reduce((s, p) => s + (p.quantity || 0), 0),
              0,
            )}`,
            14,
            currentY,
          );
          doc.text(
            `Total TP: ${reports.reduce((sum, r) => sum + (r.total_tp || 0), 0).toFixed(2)}`,
            14,
            currentY + 10,
          );

          // Save PDF to buffer
          const pdfBuffer = doc.output("arraybuffer");
          zip.file(
            `${user.name.replace(/[^a-zA-Z0-9]/g, "_")}_Sales_Report_${selectedMonth}.pdf`,
            pdfBuffer,
          );
        }),
      );

      const zipFileName = `All_Sales_Reports_${selectedZone}.zip`;
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, zipFileName);
      toast.success("All reports exported as ZIP successfully");
    } catch (error) {
      console.error("Error exporting all reports:", error);
      toast.error("Failed to export all reports");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-full mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-600 to-gray-800 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">Full Sales Report</h1>
          </div>
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Zone
                </label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={!reportData}
                >
                  <option value="">All Zones</option>
                  {uniqueZones
                    .filter((z) => z !== "")
                    .map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  {/* <option value="">All Zones</option>
                  <option value="DHAKA-01-ZONE-01">DHAKA-01-ZONE-01</option>
                  <option value="DHAKA-02-ZONE-01">DHAKA-02-ZONE-01</option>
                  <option value="DHAKA-02-ZONE-03">DHAKA-02-ZONE-03</option>
                  <option value="DHAKA-03-ZONE-03">DHAKA-03-ZONE-03</option>
                  <option value="KHULNA-ZONE-01 ">KHULNA-ZONE-01</option>
                  <option value="COMILLA-ZONE-03">COMILLA-ZONE-03</option>
                  <option value="CHITTAGONG-ZONE-03">CHITTAGONG-ZONE-03</option>
                  <option value="RANGPUR-ZONE-01">RANGPUR-ZONE-01</option>
                  <option value="BARISAL-ZONE-03">BARISAL-ZONE-03</option>
                  <option value="BOGURA-ZONE-01">BOGURA-ZONE-01</option>
                  <option value="MYMENSINGH-ZONE-01">MYMENSINGH-ZONE-01</option> */}
                </select>
              </div>
              <div>
                <button
                  onClick={generateReport}
                  disabled={isGenerating}
                  className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md shadow-sm flex items-center justify-center ${
                    isGenerating ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white mr-2"
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
                      Generating...
                    </>
                  ) : (
                    "Generate Report"
                  )}
                </button>
              </div>
              <div className="relative">
                <button
                  onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                  className="w-48 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md shadow-sm flex items-center justify-center"
                  disabled={!reportData}
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {exportDropdownOpen && (
                  <div className="absolute top-0 right-6 mt-2 w-48 bg-white rounded-md shadow-lg z-32">
                    <div
                      className="py-1"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      <button
                        onClick={() => {
                          exportToExcel();
                          setExportDropdownOpen(false);
                        }}
                        disabled={!reportData}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        role="menuitem"
                      >
                        Export to Excel
                      </button>
                      <button
                        onClick={() => {
                          exportToPDF();
                          setExportDropdownOpen(false);
                        }}
                        disabled={!reportData}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        role="menuitem"
                      >
                        Export to PDF
                      </button>
                      <button
                        onClick={() => {
                          exportAllReports();
                          setExportDropdownOpen(false);
                        }}
                        disabled={!reportData}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        role="menuitem"
                      >
                        Export All Reports (ZIP)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {reportData && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Report for {dayjs(reportData.month).format("MMMM YYYY")}
                </h2>
              </div>
              <div className="overflow-x-auto shadow-md rounded-lg max-h-[60vh]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-indigo-600 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        User Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Zone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Outlet
                      </th>
                      {reportData.days.map((day) => (
                        <th
                          key={day}
                          className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider"
                        >
                          {dayjs(day).format("D")}
                        </th>
                      ))}
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user, index) => (
                      <tr
                        key={user.userId}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.zone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.outlet}
                        </td>
                        {user.dailyTotals.map((total, dayIndex) => (
                          <td
                            key={dayIndex}
                            className={`px-3 py-4 whitespace-nowrap text-sm text-right ${
                              user.hasReport
                                ? "text-gray-900"
                                : "text-red-600 font-medium"
                            }`}
                          >
                            {user.hasReport
                              ? total > 0
                                ? total.toFixed(2)
                                : "-"
                              : "No Report"}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">
                          {user.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 sticky bottom-0 z-10">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-4 text-sm font-bold text-gray-900"
                      >
                        Total
                      </td>
                      {summary
                        ? summary.dailySums.map((sum, index) => (
                            <td
                              key={index}
                              className="px-3 py-4 text-sm font-bold text-right text-gray-900"
                            >
                              {sum.toFixed(2)}
                            </td>
                          ))
                        : reportData.days.map((_, index) => (
                            <td
                              key={index}
                              className="px-3 py-4 text-sm font-bold text-right text-gray-900"
                            >
                              0.00
                            </td>
                          ))}
                      <td className="px-6 py-4 text-sm font-bold text-right text-gray-900">
                        {summary ? summary.grandTotal.toFixed(2) : "0.00"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullSalesReport;
