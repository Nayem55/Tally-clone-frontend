import React, { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../Images/Logo.png";
import application from "../Images/Application2.png";
import admin from "../Images/admin-panel.png";
import dashboard from "../Images/dashboard.png";
import { Box, ListOrdered, Paperclip } from "lucide-react";

const Header = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem("pos-user"));

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex top-0 justify-between items-center p-4 bg-[#ffffff] shadow-md">
        <Link to="/">
          <img className={`w-[90px] sm:w-[110px]`} src={logo} alt="Logo" />
        </Link>
        <div className="flex items-center gap-4">
          <button
            className="text-xl bg-gray-100 p-2 rounded-md focus:outline-none"
            onClick={toggleSidebar}
          >
            <svg
              className="w-6 h-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed top-0 w-[80vw] sm:w-[30vw] left-0 h-full bg-[#ffffff] shadow-lg transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out z-50`}
      >
        <div className="flex justify-between items-center p-4 bg-[#002B54] text-white">
          <h2 className="text-lg font-bold">{user ? user?.name : "Menu"}</h2>
          <button
            className="text-white text-xl focus:outline-none"
            onClick={toggleSidebar}
          >
            <svg
              className="w-6 h-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="py-4">
          <Link
            to="/"
            className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
            onClick={toggleSidebar}
          >
            <svg
              className="w-[32px]"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 576 512"
            >
              <path d="M575.8 255.5c0 18-15 32.1-32 32.1l-32 0 .7 160.2c0 2.7-.2 5.4-.5 8.1l0 16.2c0 22.1-17.9 40-40 40l-16 0c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1L416 512l-24 0c-22.1 0-40-17.9-40-40l0-24 0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32l0 64 0 24c0 22.1-17.9 40-40 40l-24 0-31.9 0c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2l-16 0c-22.1 0-40-17.9-40-40l0-112c0-.9 0-1.9 .1-2.8l0-69.7-32 0c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z" />
            </svg>
            <p className="font-bold">Home</p>
          </Link>
          <Link
            to="/profile"
            className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
            onClick={toggleSidebar}
          >
            <svg
              className="w-[32px] border border-black p-1 rounded-full"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 448 512"
            >
              <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z" />
            </svg>
            <p className="font-bold">Profile</p>
          </Link>
          {/* <Link
            to={"/manage-stock"}
            className="block py-2 px-[20px] text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
            onClick={toggleSidebar}
          >
            <Layers size={24} />

            <p className="font-bold">Manage Stock</p>
          </Link> */}
          <Link
            to={"/dashboard"}
            className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
            onClick={toggleSidebar}
          >
            <img className="w-[32px]" alt="" src={dashboard} />

            <p className="font-bold">Sales Report</p>
          </Link>
          <Link
            to={"/stock-movement/dealer"}
            className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
            onClick={toggleSidebar}
          >
            <Box size={32} />
            <p className="font-bold">Stock Movement</p>
          </Link>
          {/* <Link
            to={"/primary-request"}
            className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
            onClick={toggleSidebar}
          >
            <ListOrdered size={32} />
            <p className="font-bold">Primary Request</p>
          </Link> */}
          {/* <Link
            to="/accounts"
            className="block py-2 px-[24px] text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
            onClick={toggleSidebar}
          >
            <svg
              className="w-[24px]"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 384 512"
            >
              <path d="M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM64 80c0-8.8 7.2-16 16-16l64 0c8.8 0 16 7.2 16 16s-7.2 16-16 16L80 96c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16l64 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-64 0c-8.8 0-16-7.2-16-16zm128 72c8.8 0 16 7.2 16 16l0 17.3c8.5 1.2 16.7 3.1 24.1 5.1c8.5 2.3 13.6 11 11.3 19.6s-11 13.6-19.6 11.3c-11.1-3-22-5.2-32.1-5.3c-8.4-.1-17.4 1.8-23.6 5.5c-5.7 3.4-8.1 7.3-8.1 12.8c0 3.7 1.3 6.5 7.3 10.1c6.9 4.1 16.6 7.1 29.2 10.9l.5 .1s0 0 0 0s0 0 0 0c11.3 3.4 25.3 7.6 36.3 14.6c12.1 7.6 22.4 19.7 22.7 38.2c.3 19.3-9.6 33.3-22.9 41.6c-7.7 4.8-16.4 7.6-25.1 9.1l0 17.1c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-17.8c-11.2-2.1-21.7-5.7-30.9-8.9c0 0 0 0 0 0c-2.1-.7-4.2-1.4-6.2-2.1c-8.4-2.8-12.9-11.9-10.1-20.2s11.9-12.9 20.2-10.1c2.5 .8 4.8 1.6 7.1 2.4c0 0 0 0 0 0s0 0 0 0s0 0 0 0c13.6 4.6 24.6 8.4 36.3 8.7c9.1 .3 17.9-1.7 23.7-5.3c5.1-3.2 7.9-7.3 7.8-14c-.1-4.6-1.8-7.8-7.7-11.6c-6.8-4.3-16.5-7.4-29-11.2l-1.6-.5s0 0 0 0c-11-3.3-24.3-7.3-34.8-13.7c-12-7.2-22.6-18.9-22.7-37.3c-.1-19.4 10.8-32.8 23.8-40.5c7.5-4.4 15.8-7.2 24.1-8.7l0-17.3c0-8.8 7.2-16 16-16z" />
            </svg>
            <p className="font-bold">Accounts</p>
          </Link> */}
          {user?.role && (user?.role !== "MR") && (
            <Link
              to={"/manager-report"}
              className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
              onClick={toggleSidebar}
            >
              <img className="w-[32px]" alt="" src={admin} />
              <p className="font-bold">Dealer Sale Reports</p>
            </Link>
          )}
          {user?.role === "super admin" && (
            <Link
              to={"/admin"}
              className="block py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md flex gap-4 items-center"
              onClick={toggleSidebar}
            >
              <img className="w-[32px]" alt="" src={admin} />
              <p className="font-bold">Admin Panel</p>
            </Link>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleSidebar}
        ></div>
      )}
    </div>
  );
};

export default Header;
