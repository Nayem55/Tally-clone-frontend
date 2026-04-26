import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import * as XLSX from "xlsx";

const API_CONFIG = {
  baseURL: "http://175.29.181.245:15001",
  timeout: 50000,
};

const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
});

const ManagerReports = () => {
  // State for sales data
  const [salesData, setSalesData] = useState([]);
  const [targetsData, setTargetsData] = useState({});
  const user = JSON.parse(localStorage.getItem("pos-user"));

  // Filter and display state
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedRole, setSelectedRole] = useState("SO");
  const [selectedZone, setSelectedZone] = useState(
    user.role === "ASM" ? user.zone : "",
  );
  const [selectedBelt, setSelectedBelt] = useState("");

  // Loading and error states
  const [loading, setLoading] = useState({
    sales: false,
    targets: false,
  });
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Get belt from zone name
  const getBeltFromZone = useCallback((zoneName) => {
    if (!zoneName) return "";
    if (zoneName.includes("ZONE-01")) return "Belt-1";
    if (zoneName.includes("ZONE-03")) return "Belt-3";
    return "";
  }, []);

  // Fetch sales data with embedded user info
  const fetchSalesData = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, sales: true }));
      setError(null);

      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append("startDate", startDate);
        params.append("endDate", endDate);
      } else {
        params.append("month", selectedMonth);
      }

      const response = await api.get(`/sales-reports?${params.toString()}`);
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error("Invalid data format received from server");
      }
      setSalesData(response.data);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setError(`Failed to load sales data: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, sales: false }));
    }
  }, [selectedMonth, startDate, endDate]);
  console.log(user.zone);

  const filteredZone = [
    "DHAKA-01-ZONE-01",
    "DHAKA-02-ZONE-03",
    "DHAKA-03-ZONE-03",
    "KHULNA-ZONE-01",
    "COMILLA-ZONE-03",
    "CHITTAGONG-ZONE-03",
    "RANGPUR-ZONE-01",
    "BARISAL-ZONE-03",
    "BOGURA-ZONE-01",
    "MYMENSINGH-ZONE-01",
  ].filter((z) => z.includes(user.zone));

  // Fetch targets for the selected month
  const fetchTargets = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, targets: true }));
      setError(null);

      const [year, month] = selectedMonth.split("-").map(Number);
      const response = await api.get("/targets", { params: { year, month } });

      const targetsMap = {};
      response.data.forEach((targetEntry) => {
        targetEntry.targets.forEach((target) => {
          if (target.year === year && target.month === month) {
            targetsMap[targetEntry.userID] = target.tp;
          }
        });
      });
      setTargetsData(targetsMap);
    } catch (error) {
      console.error("Error fetching targets:", error);
      setError("Failed to load targets. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, targets: false }));
    }
  }, [selectedMonth]);

  // Filter sales data based on current filters (except role)
  const filteredSalesData = useMemo(() => {
    if (!salesData || salesData.length === 0) return [];

    return salesData.filter((sale) => {
      const belt = getBeltFromZone(sale.zone);
      const matchZone = selectedZone ? sale.zone?.includes(selectedZone) : true;
      const matchBelt = selectedBelt ? belt === selectedBelt : true;

      return matchZone && matchBelt;
    });
  }, [salesData, selectedZone, selectedBelt, getBeltFromZone]);

  // Organize reports hierarchically by zone and then by role (SOM → RSM → ASM → SO)
  // Updated organizeReportsHierarchically function
  // Updated organizeReportsHierarchically function
  // Updated organizeReportsHierarchically function
  const organizeReportsHierarchically = (reports) => {
    // Group by belt first
    const reportsByBelt = reports.reduce((acc, report) => {
      const belt = getBeltFromZone(report.zone) || "Unknown Belt";
      if (!acc[belt]) {
        acc[belt] = [];
      }
      acc[belt].push(report);
      return acc;
    }, {});

    // For each belt, organize by role hierarchy
    return Object.entries(reportsByBelt).map(([belt, beltReports]) => {
      // Separate all roles
      const soms = beltReports.filter((r) => r.role === "SOM");
      const rsms = beltReports.filter((r) => r.role === "RSM");
      const asms = beltReports.filter((r) => r.role === "ASM");
      const salesOfficers = beltReports.filter((r) => r.role === "SO");

      // Create maps for relationships
      const soBySom = salesOfficers.reduce((acc, so) => {
        const som = so.som || "Unknown SOM";
        if (!acc[som]) acc[som] = [];
        acc[som].push(so);
        return acc;
      }, {});

      const soByRsm = salesOfficers.reduce((acc, so) => {
        const rsm = so.rsm || "Unknown RSM";
        if (!acc[rsm]) acc[rsm] = [];
        acc[rsm].push(so);
        return acc;
      }, {});

      const soByAsm = salesOfficers.reduce((acc, so) => {
        const asm = so.asm || "Unknown ASM";
        if (!acc[asm]) acc[asm] = [];
        acc[asm].push(so);
        return acc;
      }, {});

      // Build the hierarchical structure
      const organizedReports = [];

      // Add SOMs first
      soms.forEach((som) => {
        organizedReports.push(som);

        // Find RSMs that report to this SOM
        const somRsms = rsms.filter((rsm) =>
          soBySom[rsm.name]?.some((so) => so.som === som.name),
        );

        // Add each RSM and their hierarchy
        somRsms.forEach((rsm) => {
          organizedReports.push(rsm);

          // Find ASMs that report to this RSM
          const rsmAsms = asms.filter((asm) =>
            soByRsm[asm.name]?.some((so) => so.rsm === rsm.name),
          );

          // Add each ASM and their SOs
          rsmAsms.forEach((asm) => {
            organizedReports.push(asm);

            // Add SOs for this ASM
            const asmSos = soByAsm[asm.name] || [];
            organizedReports.push(
              ...asmSos.sort((a, b) => a.name.localeCompare(b.name)),
            );
          });

          // Add SOs that report directly to RSM (without ASM)
          const directSos = (soByRsm[rsm.name] || []).filter((so) => !so.asm);
          organizedReports.push(
            ...directSos.sort((a, b) => a.name.localeCompare(b.name)),
          );
        });

        // Add SOs that report directly to SOM (without RSM or ASM)
        const directSos = (soBySom[som.name] || []).filter(
          (so) => !so.rsm && !so.asm,
        );
        organizedReports.push(
          ...directSos.sort((a, b) => a.name.localeCompare(b.name)),
        );
      });

      // Add any remaining RSMs not under a SOM
      const remainingRsms = rsms.filter(
        (rsm) => !organizedReports.some((r) => r.userId === rsm.userId),
      );
      remainingRsms.forEach((rsm) => {
        organizedReports.push(rsm);

        // Add ASMs under this RSM
        const rsmAsms = asms.filter((asm) =>
          soByRsm[asm.name]?.some((so) => so.rsm === rsm.name),
        );

        rsmAsms.forEach((asm) => {
          organizedReports.push(asm);
          const asmSos = soByAsm[asm.name] || [];
          organizedReports.push(
            ...asmSos.sort((a, b) => a.name.localeCompare(b.name)),
          );
        });

        // Add SOs directly under RSM
        const directSos = (soByRsm[rsm.name] || []).filter((so) => !so.asm);
        organizedReports.push(
          ...directSos.sort((a, b) => a.name.localeCompare(b.name)),
        );
      });

      // Add any remaining ASMs not under a RSM
      const remainingAsms = asms.filter(
        (asm) => !organizedReports.some((r) => r.userId === asm.userId),
      );
      remainingAsms.forEach((asm) => {
        organizedReports.push(asm);
        const asmSos = soByAsm[asm.name] || [];
        organizedReports.push(
          ...asmSos.sort((a, b) => a.name.localeCompare(b.name)),
        );
      });

      // Add any remaining SOs not under any manager
      const remainingSos = salesOfficers.filter(
        (so) => !organizedReports.some((r) => r.userId === so.userId),
      );
      organizedReports.push(
        ...remainingSos.sort((a, b) => a.name.localeCompare(b.name)),
      );

      return {
        belt,
        reports: organizedReports,
      };
    });
  };
  // Main aggregation logic
  const { organizedReports, summaryData } = useMemo(() => {
    if (!filteredSalesData || filteredSalesData.length === 0) {
      return {
        organizedReports: [],
        summaryData: {
          totalSOs: 0,
          achievedSOs: 0,
          totalTP: 0,
        },
      };
    }

    // Group sales by SO
    const salesByUser = filteredSalesData.reduce((acc, sale) => {
      if (!sale.user || !sale.so) return acc;

      const userId = sale.user;
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          name: sale.so,
          outlet: sale.outlet,
          zone: sale.zone,
          role: sale.role || "SO",
          asm: sale.asm,
          rsm: sale.rsm,
          som: sale.som,
          sales: [],
          totalTP: 0,
          totalDP: 0,
          totalMRP: 0,
        };
      }
      acc[userId].sales.push(sale);
      acc[userId].totalTP += sale.total_tp || 0;
      return acc;
    }, {});

    // Manager level aggregations
    const managerLevels = ["ASM", "RSM", "SOM"];
    const managerReports = {};

    managerLevels.forEach((level) => {
      const managers = [
        ...new Set(filteredSalesData.map((s) => s[level.toLowerCase()])),
      ].filter(Boolean);

      managers.forEach((manager) => {
        const managerKey = `${level}_${manager}`;
        const teamMembers = Object.values(salesByUser).filter(
          (user) => user[level.toLowerCase()] === manager,
        );

        const teamTP = teamMembers.reduce(
          (sum, member) => sum + (member.totalTP || 0),
          0,
        );
        const managerTarget = teamMembers.reduce((sum, member) => {
          return sum + (Number(targetsData[member.userId]) || 0);
        }, 0);

        const managerAchievement =
          managerTarget > 0 ? (teamTP / managerTarget) * 100 : 0;

        managerReports[managerKey] = {
          userId: managerKey,
          name: manager,
          role: level,
          zone: teamMembers[0]?.zone || "",
          totalTP: teamTP,
          target: managerTarget,
          achievement: managerAchievement,
          salesCount: teamMembers.reduce(
            (sum, m) => sum + (m.sales?.length || 0),
            0,
          ),
          teamMembers: teamMembers.map((m) => m.userId),
          isManager: true,
        };
      });
    });

    // Combine all reports
    const allReports = [
      ...Object.values(salesByUser),
      ...Object.values(managerReports),
    ];

    // Apply filters
    const filteredReports = allReports
      .map((report) => {
        const matchRole = selectedRole ? report.role === selectedRole : true;
        const belt = getBeltFromZone(report.zone);

        if (!matchRole) return null;

        const target = report.isManager
          ? report.target // already calculated for managers
          : targetsData[report.userId] || 0;

        const achievement = target > 0 ? (report.totalTP / target) * 100 : 0;

        return {
          ...report,
          target: Number(target).toFixed(2), // Format all targets consistently
          achievement,
          belt,
          salesCount: report.salesCount || report.sales?.length || 0,
        };
      })
      .filter(Boolean);

    // Organize reports hierarchically
    const organized = organizeReportsHierarchically(filteredReports);

    // Calculate summary data (SO only) from filtered data (before role filter)
    const soReports = Object.values(salesByUser);
    const achievedSOs = soReports.filter((so) => {
      const target = targetsData[so.userId] || 0;
      return target > 0 && (so.totalTP / target) * 100 >= 100;
    }).length;

    return {
      organizedReports: organized,
      summaryData: {
        totalSOs: soReports.length,
        achievedSOs,
        totalTP: soReports.reduce((sum, so) => sum + (so.totalTP || 0), 0),
      },
    };
  }, [filteredSalesData, targetsData, selectedRole, getBeltFromZone]);

  // Fetch data when filters change
  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  useEffect(() => {
    if (selectedMonth) {
      fetchTargets();
    }
  }, [selectedMonth, fetchTargets]);

  const isLoading = loading.sales || loading.targets;

  const exportToExcel = () => {
    // Flatten the organized reports for export
    const exportData = organizedReports.flatMap((zoneGroup) =>
      zoneGroup.reports.map((report) => ({
        "User Name": report.name,
        Outlet: report.outlet || "-",
        Zone: report.zone,
        Role: report.role,
        Belt: report.belt,
        Target: report.target,
        "Total TP": report.totalTP.toFixed(2),
        "Achievement (%)": report.achievement.toFixed(1),
        "Total Sales": report.salesCount,
      })),
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Dealer Sales Report");

    const fileName = `Dealer_Sales_Report_${
      selectedMonth ||
      (startDate && endDate
        ? `${startDate}_to_${endDate}`
        : dayjs().format("YYYY-MM"))
    }.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedRole("");
    setSelectedZone("");
    setSelectedBelt("");
  };

  return (
    <div className="flex sm:px-32 p-4">
      <div className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-xl sm:text-2xl font-bold">
            Dealer Sales Reports
          </h2>
          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center"
            disabled={isLoading || organizedReports.length === 0}
          >
            Export to Excel
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}

        {/* Summary Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-100 p-4 rounded-lg shadow text-center">
            <h3 className="text-lg font-semibold">Active SOs</h3>
            <p className="text-xl font-bold">{summaryData.totalSOs}</p>
          </div>
          <div className="bg-green-100 p-4 rounded-lg shadow text-center">
            <h3 className="text-lg font-semibold">Target Achieved</h3>
            <p className="text-xl font-bold">
              {summaryData.achievedSOs} / {summaryData.totalSOs}
            </p>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg shadow text-center">
            <h3 className="text-lg font-semibold">Total TP</h3>
            <p className="text-xl font-bold">
              {summaryData.totalTP.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-4 flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-end">
          {/* Date Filters */}
          <div className="w-full sm:w-auto">
            <label className="font-medium block mb-1">Select Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded p-2 w-full"
              disabled={startDate && endDate}
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="font-medium block mb-1">Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded p-2 w-full"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="font-medium block mb-1">End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded p-2 w-full"
            />
          </div>

          {/* Zone Filter */}
          <div className="w-full sm:w-auto">
            <label className="font-medium block mb-1">Zone:</label>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="border rounded p-2 w-full"
            >
              {filteredZone.map((zone) => (
                <option value={zone}>{zone}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Table */}
        {isLoading ? (
          <div className="flex justify-center items-center my-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
          </div>
        ) : organizedReports.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-lg text-gray-600">
              No sales data found for the selected filters
            </p>
          </div>
        ) : (
          <div className="relative overflow-auto max-h-[90vh]">
            {organizedReports.map((beltGroup, beltIndex) => (
              <div key={beltIndex} className="mb-8">
                <h3 className="text-lg font-bold bg-gray-200 p-2 sticky top-0 z-10">
                  {beltGroup.belt}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2">User</th>
                        <th className="p-2">Outlet</th>
                        <th className="p-2">Zone</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Target (TP)</th>
                        <th className="p-2">Sales (TP)</th>
                        <th className="p-2">Achievement</th>
                        {/* <th className="p-2">Sales Count</th>
                        <th className="p-2">Action</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {beltGroup.reports.map((report, index) => (
                        <tr
                          key={`${beltIndex}-${index}`}
                          className={`border hover:bg-gray-50 ${
                            report.isManager ? "bg-blue-50" : ""
                          }`}
                        >
                          <td className="border p-2">
                            {report.name}
                            {report.isManager && (
                              <span className="ml-2 text-xs text-blue-600">
                                ({report.role})
                              </span>
                            )}
                          </td>
                          <td className="border p-2">{report.outlet || "-"}</td>
                          <td className="border p-2">{report.zone}</td>
                          <td className="border p-2">{report.role}</td>
                          <td className="border p-2">{report.target}</td>
                          <td className="border p-2">
                            {report.totalTP.toFixed(2)}
                          </td>
                          <td className="border p-2">
                            <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`absolute inset-0 flex items-center justify-center h-full rounded-full ${
                                  report.achievement >= 100
                                    ? "bg-green-500"
                                    : report.achievement >= 70
                                      ? "bg-blue-500"
                                      : report.achievement >= 40
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    report.achievement,
                                  )}%`,
                                  transition: "width 0.5s ease-in-out",
                                }}
                              ></div>
                              {report.target > 0 && (
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white font-bold">
                                  {report.achievement.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </td>
                          {/* <td className="border p-2 text-center">
                            {report.salesCount}
                          </td> */}
                          {/* <td className="border p-2">
                            {!report.isManager && (
                              <button
                                className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                                onClick={() =>
                                  navigate(
                                    `/sales-report/daily/${report.userId}?${
                                      startDate && endDate
                                        ? `startDate=${startDate}&endDate=${endDate}`
                                        : `month=${selectedMonth}`
                                    }`
                                  )
                                }
                              >
                                Details
                              </button>
                            )}
                          </td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerReports;
