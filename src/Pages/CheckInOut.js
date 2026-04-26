import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import duration from "dayjs/plugin/duration";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dkjur8lgg/image/upload";
const UPLOAD_PRESET = "Office";

export default function AttendanceVoucher() {
  const navigate = useNavigate();
  const [localUser, setLocalUser] = useState(
    JSON.parse(localStorage.getItem("attendance-user"))
  );
  const [note, setNote] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [time, setTime] = useState(dayjs().tz("Asia/Dhaka").format("hh:mm A"));
  const [locErr, setLocErr] = useState("");
  const [totalWorkingHours, setTotalWorkingHours] = useState("00:00:00");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /* ───────────────────────── clock ───────────────────────── */
  useEffect(() => {
    const id = setInterval(
      () => setTime(dayjs().tz("Asia/Dhaka").format("hh:mm A")),
      60000
    );
    return () => clearInterval(id);
  }, []);

  /* ───────────────────────── camera ───────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        // toast.error("Camera access denied");
        console.log("Camera access denied");
      }
    })();
  }, []);

  /* ───────────────────────── working hours calculation ───────────────────────── */
  useEffect(() => {
    let intervalId;

    if (localUser?.checkIn && localUser?.lastCheckedIn) {
      const calculateActiveTime = () => {
        const checkInTime = dayjs(localUser.lastCheckedIn);
        const currentTime = dayjs();
        const duration = dayjs.duration(currentTime.diff(checkInTime));

        const hours = duration.hours().toString().padStart(2, "0");
        const minutes = duration.minutes().toString().padStart(2, "0");
        const seconds = duration.seconds().toString().padStart(2, "0");

        setTotalWorkingHours(`${hours}:${minutes}:${seconds}`);
      };

      calculateActiveTime();
      intervalId = setInterval(calculateActiveTime, 1000);
    }

    return () => clearInterval(intervalId);
  }, [localUser]);

  const captureAndUpload = async () => {
    if (!videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { videoWidth: vw, videoHeight: vh } = videoRef.current;

    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(videoRef.current, 0, 0, vw, vh);

    const maxW = 240,
      maxH = 320;
    let w = vw,
      h = vh;
    if (w > maxW || h > maxH) {
      const ratio = w / h;
      if (w > h) {
        w = maxW;
        h = Math.round(w / ratio);
      } else {
        h = maxH;
        w = Math.round(h * ratio);
      }
    }
    const rsCnv = document.createElement("canvas");
    rsCnv.width = w;
    rsCnv.height = h;
    rsCnv.getContext("2d").drawImage(canvas, 0, 0, w, h);

    return new Promise((resolve, reject) => {
      rsCnv.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append("file", blob, "att.png");
        fd.append("upload_preset", UPLOAD_PRESET);
        setImgLoading(true);
        try {
          const { data } = await axios.post(CLOUDINARY_URL, fd);
          setImageUrl(data.secure_url);
          toast.success("Photo uploaded");
          resolve(data.secure_url);
        } catch (err) {
          toast.error("Upload failed");
          reject(err);
        } finally {
          setImgLoading(false);
        }
      }, "image/png");
    });
  };

  /* ───────────────────────── geolocation ───────────────────────── */
  const getLocation = () =>
    new Promise((res, rej) => {
      if (!navigator.geolocation) return rej("No geolocation API");
      navigator.geolocation.getCurrentPosition(
        ({ coords }) =>
          res({ latitude: coords.latitude, longitude: coords.longitude }),
        async () => {
          try {
            const { data } = await axios.get(
              "https://ipinfo.io/json?token=6cc3a1d32d5129"
            );
            const [lat, lon] = data.loc.split(",");
            res({ latitude: lat, longitude: lon });
          } catch {
            setLocErr("Location unavailable");
            rej("loc");
          }
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });

  /* ───────────────────────── submit ───────────────────────── */
  const submit = async (mode) => {
    if (!localUser) return toast.error("No user");
    setLoading(true);
    try {
      const photo = imageUrl;
      const loc = await getLocation();
      const timeStamp = dayjs().tz("Asia/Dhaka");
      const body = {
        userId: localUser._id,
        note,
        image: photo,
        time: timeStamp.format("YYYY-MM-DD HH:mm:ss"),
        date: timeStamp.format("YYYY-MM-DD"),
        status: "Success",
        location: loc,
      };
      const url =
        mode === "in"
          ? "https://attendance-app-server-blue.vercel.app/checkin"
          : "https://attendance-app-server-blue.vercel.app/checkout";
      
      const { data } = await axios.post(url, body);
      
      // Update local user data
      const updatedUser = {
        ...localUser,
        checkIn: mode === "in",
        lastCheckedIn: mode === "in" ? timeStamp.format() : localUser.lastCheckedIn
      };
      
      setLocalUser(updatedUser);
      localStorage.setItem("attendance-user", JSON.stringify(updatedUser));
      
      toast.success(`Check-${mode === "in" ? "in" : "out"} successful`);
      
      // If checking out, navigate back to home
      if (mode === "out") {
        navigate("/");
      }
    } catch (error) {
      toast.error(error.response ? error.response.data.message : "Error during check-in");
    } finally {
      setLoading(false);
    }
  };

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden max-w-md mx-2">
      {/* Header */}
      <div className="bg-[#002B54] text-white p-4">
        <h2 className="text-xl font-bold text-center">Attendance Voucher</h2>
      </div>

      {/* Status Bar */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Current Status</p>
            <p className="font-semibold">
              {localUser?.checkIn ? "Checked In" : "Not Checked In"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Working Hours</p>
            <p className="font-semibold">{totalWorkingHours}</p>
          </div>
        </div>
      </div>

      {/* Camera Preview */}
      <div className="p-4">
        <div className="relative w-full overflow-hidden rounded-lg border-2 border-gray-200 aspect-video bg-gray-100 mb-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="captured"
              className="object-contain w-full h-full"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Camera Controls */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={captureAndUpload}
            disabled={imgLoading}
            className="flex-1 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {imgLoading ? "Uploading..." : "Capture Photo"}
          </button>
          {imageUrl && (
            <button
              onClick={() => setImageUrl("")}
              className="flex-1 py-2 rounded bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              Retake
            </button>
          )}
        </div>

        {/* Note Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Enter any additional notes..."
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Meta Information */}
        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-medium">
                {dayjs().tz("Asia/Dhaka").format("DD MMM YYYY")}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Time</p>
              <p className="font-medium">{time}</p>
            </div>
            {localUser?.checkIn && localUser?.lastCheckedIn && (
              <>
                <div>
                  <p className="text-gray-500">Check-In Time</p>
                  <p className="font-medium">
                    {dayjs(localUser.lastCheckedIn)
                      .tz("Asia/Dhaka")
                      .format("hh:mm A")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p className="font-medium">{totalWorkingHours}</p>
                </div>
              </>
            )}
          </div>
          {locErr && (
            <div className="mt-2 text-xs text-red-600">{locErr}</div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={() => submit(localUser?.checkIn ? "out" : "in")}
          disabled={loading}
          className={`w-full py-3 rounded-md text-white font-medium ${
            localUser?.checkIn
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          } transition-colors`}
        >
          {loading
            ? "Processing..."
            : localUser?.checkIn
            ? "Check Out"
            : "Check In"}
        </button>

      </div>
    </div>
  );
}