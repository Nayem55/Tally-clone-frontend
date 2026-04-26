import { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

const MonthlyTargetPage = () => {
  const [users, setUsers] = useState([]);
  const [targets, setTargets] = useState({}); // stored from server
  const [tempTargets, setTempTargets] = useState({}); // editable copy
  const [year, setYear] = useState(dayjs().year());
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  /* ------------------------------------------------------------------ */
  /*  FETCH USERS                                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get("http://175.29.181.245:15001/getAllUser");
        setUsers(res.data);
      } catch (error) {
        console.error("Failed to fetch users", error);
        toast.error("Failed to fetch users");
      }
    };
    fetchUsers();
  }, []);

  /* ------------------------------------------------------------------ */
  /*  FETCH TARGETS (TP = DP on server)                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const fetchTargets = async () => {
      if (!year || !month) return;

      try {
        setLoading(true);
        const res = await axios.get("http://175.29.181.245:15001/targets", {
          params: { year, month },
        });

        const targetsMap = {};
        res.data.forEach((targetEntry) => {
          targetEntry.targets.forEach((target) => {
            if (
              target.year === parseInt(year) &&
              target.month === parseInt(month)
            ) {
              // TP and DP are the same on the server
              targetsMap[targetEntry.userID] = {
                tp: target.tp, // same as target.dp
                userName: targetEntry.userName,
                userNumber: targetEntry.userNumber,
                userZone: targetEntry.userZone,
              };
            }
          });
        });

        setTargets(targetsMap);
        setTempTargets(targetsMap);
      } catch (error) {
        console.error("Failed to fetch targets", error);
        toast.error("Failed to fetch targets");
      } finally {
        setLoading(false);
      }
    };

    fetchTargets();
  }, [year, month]);

  /* ------------------------------------------------------------------ */
  /*  HANDLE TP INPUT CHANGE                                            */
  /* ------------------------------------------------------------------ */
  const handleTargetChange = (userID, value) => {
    const tp = value.trim() === "" ? "" : parseFloat(value);
    setTempTargets((prev) => ({
      ...prev,
      [userID]: {
        ...prev[userID],
        tp: isNaN(tp) ? "" : tp.toString(),
      },
    }));
  };

  /* ------------------------------------------------------------------ */
  /*  SAVE / UPDATE SINGLE USER                                         */
  /* ------------------------------------------------------------------ */
  const handleUserTargetSaveOrUpdate = async (user) => {
    const tp = tempTargets[user._id]?.tp;

    if (!tp || tp === "") {
      return toast.error("Please enter a valid TP value");
    }

    setLoading(true);
    try {
      const targetData = {
        userID: user._id,
        userName: user.name,
        userNumber: user.number,
        userZone: user.zone,
        year: parseInt(year),
        month: parseInt(month),
        tp,
        dp: tp, // <-- SAME VALUE FOR DP
      };

      const exists = targets[user._id] !== undefined;
      if (exists) {
        await axios.put("http://175.29.181.245:15001/targets", targetData);
        toast.success("Target updated successfully");
      } else {
        await axios.post("http://175.29.181.245:15001/targets", targetData);
        toast.success("Target created successfully");
      }

      // Refresh targets
      await refreshTargets();
    } catch (error) {
      console.error("Failed to save target", error);
      toast.error(error.response?.data?.message || "Error saving target");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  BULK SAVE ALL CHANGES                                             */
  /* ------------------------------------------------------------------ */
  const handleBulkSave = async () => {
    if (Object.keys(tempTargets).length === 0) {
      return toast.error("No targets to save");
    }

    setLoading(true);
    try {
      const targetsToSave = users
        .filter((user) => tempTargets[user._id]?.tp)
        .map((user) => ({
          userID: user._id,
          userName: user.name,
          userNumber: user.number,
          userZone: user.zone,
          year: parseInt(year),
          month: parseInt(month),
          tp: tempTargets[user._id].tp,
          dp: tempTargets[user._id].tp, // SAME
        }));

      await axios.post(
        "http://175.29.181.245:15001/targets/bulk",
        targetsToSave,
      );

      toast.success(`Saved ${targetsToSave.length} targets`);
      await refreshTargets();
    } catch (error) {
      console.error("Bulk save failed:", error);
      toast.error(error.response?.data?.message || "Bulk save failed");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  REFRESH TARGETS (common helper)                                   */
  /* ------------------------------------------------------------------ */
  const refreshTargets = async () => {
    const res = await axios.get("http://175.29.181.245:15001/targets", {
      params: { year, month },
    });

    const map = {};
    res.data.forEach((entry) => {
      entry.targets.forEach((t) => {
        if (t.year === parseInt(year) && t.month === parseInt(month)) {
          map[entry.userID] = {
            tp: t.tp,
            userName: entry.userName,
            userNumber: entry.userNumber,
            userZone: entry.userZone,
          };
        }
      });
    });

    setTargets(map);
    setTempTargets(map);
  };

  /* ------------------------------------------------------------------ */
  /*  EXCEL IMPORT / EXPORT                                             */
  /* ------------------------------------------------------------------ */
  const handleFileUpload = (e) => {
    const uploaded = e.target.files[0];
    if (!uploaded) return;
    setFile(uploaded);
  };

  const processExcelData = (data) => {
    const newTemp = { ...tempTargets };
    let count = 0;

    data.forEach((row) => {
      const user = users.find(
        (u) =>
          u.name === row["User Name"] ||
          u._id === row["User ID"] ||
          u.number === row["User Number"],
      );

      if (user && row["TP Target"]) {
        const tp = parseFloat(row["TP Target"]);
        if (!isNaN(tp)) {
          newTemp[user._id] = {
            tp: tp.toString(),
            userName: user.name,
            userNumber: user.number,
            userZone: user.zone,
          };
          count++;
        }
      }
    });

    setTempTargets(newTemp);
    return count;
  };

  const handleBulkImport = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setImportLoading(true);
    try {
      const data = await readExcelFile(file);
      const processed = processExcelData(data);

      if (processed > 0) {
        toast.success(`Imported ${processed} targets. Review & save.`);
      } else {
        toast.error("No valid targets found");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to process file");
    } finally {
      setImportLoading(false);
      setFile(null);
      const el = document.getElementById("file-upload");
      if (el) el.value = "";
    }
  };

  const readExcelFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const downloadDemoFile = () => {
    const demo = users.map((u) => ({
      "User ID": u._id,
      "User Name": u.name,
      "Outlet Name": u.outlet,
      "User Number": u.number,
      "User Zone": u.zone,
      "TP Target": "",
    }));

    const ws = XLSX.utils.json_to_sheet(demo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Targets");
    XLSX.writeFile(wb, `Monthly_Targets_Template_${year}_${month}.xlsx`);
  };

  /* ------------------------------------------------------------------ */
  /*  SUMMARY CALCULATION                                               */
  /* ------------------------------------------------------------------ */
  const calculateTotalTargets = () => {
    let totalTP = 0;
    let userCount = 0;

    Object.values(tempTargets).forEach((t) => {
      const tp = parseFloat(t.tp) || 0;
      totalTP += tp;
      if (tp > 0) userCount += 1;
    });

    return {
      totalTP: totalTP.toFixed(2),
      userCountWithTarget: userCount,
    };
  };

  /* ------------------------------------------------------------------ */
  /*  RENDER                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-6 bg-gray-100 min-h-screen flex-1">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">
            Monthly Target Management
          </h2>

          {/* Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-lg font-medium mb-2">
              Summary for{" "}
              {dayjs()
                .month(month - 1)
                .format("MMMM")}{" "}
              {year}
            </h3>
            <div className="flex gap-8">
              <p>
                <span className="font-semibold">Total TP Target:</span>{" "}
                {calculateTotalTargets().totalTP}
              </p>
              <p>
                <span className="font-semibold">Users with Targets:</span>{" "}
                {calculateTotalTargets().userCountWithTarget}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="border border-gray-300 rounded p-2 w-32 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Year"
                min="2000"
                max="2100"
              />
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border border-gray-300 rounded p-2 w-40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {dayjs().month(i).format("MMMM")}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleBulkSave}
              disabled={loading || Object.keys(tempTargets).length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving All..." : "Save All Changes"}
            </button>
          </div>

          {/* Bulk Import Section */}
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-inner">
            <h3 className="text-lg font-medium mb-3">
              Bulk Import Targets from Excel
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <button
                  onClick={downloadDemoFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Download Template
                </button>
                <div className="flex-1 w-full">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                <button
                  onClick={handleBulkImport}
                  disabled={!file || importLoading || loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {importLoading ? "Importing..." : "Import File"}
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">Import Instructions:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Download the template to get the correct columns.</li>
                  <li>
                    Fill only the <strong>TP Target</strong> column.
                  </li>
                  <li>Do not edit User ID / Name / Number / Zone.</li>
                  <li>Upload → review → click “Save All Changes”.</li>
                </ol>
              </div>
            </div>
          </div>

          {loading && (
            <div className="mb-4 text-center text-purple-600 font-medium">
              Loading data... Please wait.
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border-b p-3 text-left font-medium">
                    User Name
                  </th>
                  <th className="border-b p-3 text-left font-medium">Outlet</th>
                  <th className="border-b p-3 text-left font-medium">Number</th>
                  <th className="border-b p-3 text-left font-medium">Zone</th>
                  <th className="border-b p-3 text-center font-medium">
                    TP Target
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="border-b p-3">{user.name}</td>
                    <td className="border-b p-3">{user.outlet}</td>
                    <td className="border-b p-3">{user.number}</td>
                    <td className="border-b p-3">{user.zone}</td>
                    <td className="border-b p-3 text-center">
                      <input
                        type="number"
                        className="border border-gray-300 p-2 rounded w-32 text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={tempTargets[user._id]?.tp || ""}
                        onChange={(e) =>
                          handleTargetChange(user._id, e.target.value)
                        }
                        placeholder="Enter TP"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyTargetPage;
