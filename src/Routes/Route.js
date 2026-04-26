import { createBrowserRouter } from "react-router-dom";
import LoginForm from "../Component/Login";
import Main from "../Layout/Main";
import SignUpForm from "../Component/Signup";
import Profile from "../Component/Profile";
import TodaysSale from "../Pages/Homepage/Homepage";
import UserDashboard from "../Pages/UserDashboard";
import AdminProducts from "./../Pages/AdminPanel/Products";
import DailyReport from "../Pages/AdminPanel/DailyReport";
import ManageStock from "../Pages/AdminPanel/ManageStock";
import UserManagementPage from "../Pages/AdminPanel/Users";
import DealerSalesReport from "../Pages/AdminPanel/DealerSalesReport";
import CategoryWiseSalesReport from "../Pages/AdminPanel/CategorySalesReport";
import CategoryReportDetails from "../Pages/AdminPanel/CategoryReportDetails";
import ProductWiseSalesReport from "../Pages/AdminPanel/ProductWiseSalesReport";
import DailyDealerSalesReport from "../Pages/AdminPanel/DailyDealerSalesReport";
import ManageUserStock from "../Pages/UserStock";
import MonthlyTargetPage from "../Pages/AdminPanel/MonthlyTarget";
import AdminHomePage from "../Pages/AdminPanel/AdminHomePage";
import Home from "../Pages/Homepage/Homepage";
import PromotionalPage from "../Pages/AdminPanel/Promotion";
import StockMovementReport from "../Pages/AdminPanel/StockMovementReport";
import GroupStockMovementReport from "../Pages/AdminPanel/StockMovementGroupwise";
import Accounts from "../Pages/Accounts";
import FinancialMovementReport from "../Pages/FinancialMovementReport";
import CreateProductPage from "../Pages/CreateProductPage";
import AlterProductsPage from "../Pages/AlterProductsPage";
import CreateUserPage from "../Pages/CreateUserPage";
import AlterUsersPage from "../Pages/AlterUsersPage";
import CreateCategoryPage from "../Pages/CreateCategoryPage";
import AlterCategoriesPage from "../Pages/AlterCategoriesPage";
import CreateOutletPage from "../Pages/CreateOutletPage";
import AlterOutletsPage from "../Pages/AlterOutletsPage";
import CategoryTargetPage from "../Pages/CategoryTargetPage";
import BrandWiseSalesReport from "../Pages/BrandsSaleReport";
import BrandTargetPage from "../Pages/BrandTargetPage";
import TDDAdminPanel from "../Pages/TDDA";
import SalarySheet from "../Pages/AdminPanel/SalarySheet";
import OrderRequests from "../Pages/AdminPanel/OrderRequests";
import PrimaryRequest from "../Pages/PrimaryRequest";
import AlterBrandsPage from "../Pages/AdminPanel/AlterBrandsPage";
import CreateBrandPage from "../Pages/AdminPanel/CreateBrandPage";
import CreatePriceLevelPage from "../Pages/AdminPanel/CreatePriceLevelPage";
import AlterPriceLevelsPage from "../Pages/AdminPanel/AlterPriceLevelsPage";
import PaymentRequests from "../Pages/AdminPanel/PaymentRequests";
import ManagerReports from "../Pages/ManagerReports";
import FullSalesReport from "../Pages/FullSalesReport";
import StockTransactionsReport from "../Pages/StockTransactionsReport";
import ProductStockMovementReport from "../Pages/ProductStockMovementReport";
import BrandStockMovementReport from "../Pages/BrandStockMovementReport";
import CategoryStockMovementReport from "../Pages/CategoryStockMovementReport";
import ProtectedRoute from "../Component/ProtectedRoute";

// Import ProtectedRoute
const router = createBrowserRouter([
  {
    path: "/",
    element: <Main />,
    children: [
      // Public Routes
      { path: "/", element: <Home /> },
      { path: "/home", element: <TodaysSale /> },
      { path: "/login", element: <LoginForm /> },
      { path: "/signup", element: <SignUpForm /> },
      { path: "/profile", element: <Profile /> },
      { path: "/primary-request", element: <PrimaryRequest /> },
      { path: "/dashboard", element: <UserDashboard /> },
      { path: "/accounts", element: <Accounts /> },
      { path: "/manage-stock", element: <ManageUserStock /> },
      { path: "/manager-report", element: <ManagerReports /> },

      // Stock Movement (User-level)
      { path: "/stock-movement/dealer", element: <StockMovementReport /> },
      { path: "/stock-movement/product", element: <ProductStockMovementReport /> },
      { path: "/stock-movement/category", element: <CategoryStockMovementReport /> },
      { path: "/stock-movement/brand", element: <BrandStockMovementReport /> },
      { path: "/stock-movement/group", element: <GroupStockMovementReport /> },

      // Daily Report (per user)
      { path: "/sales-report/daily/:userId", element: <DailyReport /> },

      // TADA (maybe user-level)
      { path: "admin/tada", element: <TDDAdminPanel /> },

      // ==================== ADMIN PANEL - SUPER ADMIN ONLY ====================
      {
        path: "/admin",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AdminHomePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/salary",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <SalarySheet />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/products",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AdminProducts />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/create-product",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CreateProductPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/create-brand",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CreateBrandPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/alter-products",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AlterProductsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/alter-brands",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AlterBrandsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/create-user",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CreateUserPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/alter-users",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AlterUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/create-category",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CreateCategoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/alter-categories",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AlterCategoriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/create-outlet",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CreateOutletPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/alter-outlets",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AlterOutletsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/promotion",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <PromotionalPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/stock-movement",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <StockMovementReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/sales-movement/dealer-wise",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <DealerSalesReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/full-sales-report",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <FullSalesReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/full-stock-report",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <StockTransactionsReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/sales-movement/category-wise",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CategoryWiseSalesReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/sales-movement/brand-wise",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <BrandWiseSalesReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/money-transaction",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <FinancialMovementReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/sales-movement/category-wise/detail/:category",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CategoryReportDetails />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/sales-movement/product-wise",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <ProductWiseSalesReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/manage-stock",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <ManageStock />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/order-requests",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <OrderRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/users",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <UserManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/monthly-target",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <MonthlyTargetPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/category-target",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CategoryTargetPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/brand-target",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <BrandTargetPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/daily/dealer-sales-report",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <DailyDealerSalesReport />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/create-pricelevel",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <CreatePriceLevelPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/alter-pricelevels",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <AlterPriceLevelsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/payment-request",
        element: (
          <ProtectedRoute allowedRoles={["super admin"]}>
            <PaymentRequests />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default router;