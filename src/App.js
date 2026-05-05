import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./Component/Sidebar";
import Navbar from "./Component/Navbar";
import DashboardPage from "./Pages/DashboardPage";
import CompanyList from "./Pages/CompanyList";
import Groups from "./Pages/Groups";
import Ledgers from "./Pages/Ledgers";
import Items from "./Pages/Items";
import CoaGroups from "./Pages/CoaGroups";
import CoaLedgers from "./Pages/CoaLedgers";
import CoaStockItems from "./Pages/CoaStockItems";
import CoaStockGroups from "./Pages/CoaStockGroups";
import PriceLevels from "./Pages/PriceLevels";
import AlterItemPrices from "./Pages/AlterItemPrices";
import StockSummary from "./Pages/StockSummary";
import VoucherList from "./Pages/VoucherList";
import VoucherRegister from "./Pages/VoucherRegister";
import TrialBalance from "./Pages/TrialBalance";
import ProfitLoss from "./Pages/ProfitLoss";
import BalanceSheetPage from "./Pages/BalanceSheetPage";
import DayBookPage from "./Pages/DayBookPage";
import VoucherBookPage from "./Pages/VoucherBookPage";
import VoucherTypesPage from "./Pages/VoucherTypesPage";
import NotImplementedPage from "./Pages/NotImplementedPage";
import MasterDataPage from "./Pages/MasterDataPage";
import CashFlowPage from "./Pages/CashFlowPage";
import OutstandingReportPage from "./Pages/OutstandingReportPage";
import InventoryVoucherPage from "./Pages/InventoryVoucherPage";
import StockGroupSummaryPage from "./Pages/StockGroupSummaryPage";
import PosVoucherPage from "./Pages/PosVoucherPage";
import CustomerBehaviourOverviewPage from "./Pages/CustomerBehaviourOverviewPage";
import ProductCustomerReportPage from "./Pages/ProductCustomerReportPage";
import CustomerDimensionReportPage from "./Pages/CustomerDimensionReportPage";
import StockItemDetailPage from "./Pages/StockItemDetailPage";
import InventoryMovementAnalysisPage from "./Pages/InventoryMovementAnalysisPage";
import ShortcutReferencePage from "./Pages/ShortcutReferencePage";
import CommandSearchModal from "./Component/CommandSearchModal";
import AlterVoucherEntryPage from "./Pages/AlterVoucherEntryPage";
import EmployeeCreationPage from "./Pages/EmployeeCreationPage";
import LedgerDetailPage from "./Pages/LedgerDetailPage";

function Placeholder(title, subtitle) {
  return <NotImplementedPage title={title} subtitle={subtitle} />;
}

function AppShell() {
  return (
    <>
      <Navbar />
      <CommandSearchModal />
      <div className="flex">
        <Sidebar />
        <main className="min-h-screen flex-1 bg-slate-100">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/shortcuts" element={<ShortcutReferencePage />} />

            <Route path="/masters/create/group" element={<Groups />} />
            <Route path="/masters/alter/group" element={<Groups />} />
            <Route path="/masters/create/ledger" element={<Ledgers />} />
            <Route path="/masters/alter/ledger" element={<Ledgers />} />
            <Route
              path="/masters/create/voucher-type"
              element={
                <VoucherTypesPage
                  title="Create Voucher Type"
                  subtitle="Create accounting and inventory voucher types similar to Tally's master maintenance."
                />
              }
            />
            <Route
              path="/masters/alter/voucher"
              element={
                <VoucherRegister
                  title="Alter Submitted Vouchers"
                  subtitle="Review and update the vouchers already submitted for the selected company."
                />
              }
            />
            <Route
              path="/masters/alter/voucher-type"
              element={
                <VoucherTypesPage
                  title="Alter Voucher Type"
                  subtitle="Review and update the voucher types already defined for the selected company."
                />
              }
            />
            <Route
              path="/masters/create/currency"
              element={
                <MasterDataPage
                  title="Currencies"
                  subtitle="Create additional currencies for company-level multi-currency maintenance."
                  endpoint="currencies"
                  fields={[
                    { name: "code", label: "Code", placeholder: "Currency code" },
                    { name: "symbol", label: "Symbol", placeholder: "Currency symbol" },
                    { name: "name", label: "Name", placeholder: "Currency name" },
                    { name: "decimalPlaces", label: "Decimals", type: "number", placeholder: "Decimal places" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/alter/currency"
              element={
                <MasterDataPage
                  title="Currencies"
                  subtitle="Alter additional currencies defined for the selected company."
                  endpoint="currencies"
                  fields={[
                    { name: "code", label: "Code", placeholder: "Currency code" },
                    { name: "symbol", label: "Symbol", placeholder: "Currency symbol" },
                    { name: "name", label: "Name", placeholder: "Currency name" },
                    { name: "decimalPlaces", label: "Decimals", type: "number", placeholder: "Decimal places" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/create/cost-category"
              element={
                <MasterDataPage
                  title="Cost Categories"
                  subtitle="Create cost categories for parallel cost tracking and allocation."
                  endpoint="cost-categories"
                  fields={[
                    { name: "name", label: "Name", placeholder: "Cost category name" },
                    { name: "alias", label: "Alias", placeholder: "Alias" },
                    { name: "description", label: "Description", placeholder: "Description" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/alter/cost-category"
              element={
                <MasterDataPage
                  title="Cost Categories"
                  subtitle="Alter cost categories used for management allocations."
                  endpoint="cost-categories"
                  fields={[
                    { name: "name", label: "Name", placeholder: "Cost category name" },
                    { name: "alias", label: "Alias", placeholder: "Alias" },
                    { name: "description", label: "Description", placeholder: "Description" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/create/cost-centre"
              element={
                <MasterDataPage
                  title="Cost Centres"
                  subtitle="Create cost centres for branch, department, or channel-level tracking."
                  endpoint="cost-centres"
                  fields={[
                    { name: "name", label: "Name", placeholder: "Cost centre name" },
                    { name: "alias", label: "Alias", placeholder: "Alias" },
                    { name: "description", label: "Description", placeholder: "Description" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/alter/cost-centre"
              element={
                <MasterDataPage
                  title="Cost Centres"
                  subtitle="Alter cost centres used for reporting and allocation."
                  endpoint="cost-centres"
                  fields={[
                    { name: "name", label: "Name", placeholder: "Cost centre name" },
                    { name: "alias", label: "Alias", placeholder: "Alias" },
                    { name: "description", label: "Description", placeholder: "Description" },
                  ]}
                />
              }
            />
            <Route path="/masters/create/employee" element={<EmployeeCreationPage mode="create" />} />
            <Route path="/masters/alter/employee" element={<EmployeeCreationPage mode="alter" />} />
            <Route
              path="/masters/create/stock-group"
              element={
                <Groups
                  stockOnly
                  title="Stock Groups"
                  subtitle="Create stock groups under Stock-in-Trade for professional inventory classification."
                />
              }
            />
            <Route
              path="/masters/alter/stock-group"
              element={
                <Groups
                  stockOnly
                  title="Stock Groups"
                  subtitle="Alter stock groups maintained under the stock hierarchy."
                />
              }
            />
            <Route
              path="/masters/create/stock-category"
              element={
                <MasterDataPage
                  title="Stock Categories"
                  subtitle="Create and alter stock categories for better item classification."
                  endpoint="stock-categories"
                  parentOptionsEndpoint="stock-categories"
                  fields={[
                    { name: "name", label: "Name", placeholder: "Stock category name" },
                    { name: "parentId", label: "Parent Category", type: "select", placeholder: "Select parent category" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/alter/stock-category"
              element={
                <MasterDataPage
                  title="Stock Categories"
                  subtitle="Alter stock categories and their parent structure."
                  endpoint="stock-categories"
                  parentOptionsEndpoint="stock-categories"
                  fields={[
                    { name: "name", label: "Name", placeholder: "Stock category name" },
                    { name: "parentId", label: "Parent Category", type: "select", placeholder: "Select parent category" },
                  ]}
                />
              }
            />
            <Route path="/masters/create/stock-item" element={<Items />} />
            <Route path="/masters/alter/stock-item" element={<Items />} />
            <Route
              path="/masters/create/unit"
              element={
                <MasterDataPage
                  title="Units of Measure"
                  subtitle="Create quantity units for stock item maintenance and inventory vouchers."
                  endpoint="units"
                  fields={[
                    { name: "name", label: "Unit Name", placeholder: "Unit name" },
                    { name: "symbol", label: "Symbol", placeholder: "Symbol / short name" },
                    { name: "decimalPlaces", label: "Decimals", type: "number", placeholder: "Decimal places" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/alter/unit"
              element={
                <MasterDataPage
                  title="Units of Measure"
                  subtitle="Alter units and decimal precision used in item quantities."
                  endpoint="units"
                  fields={[
                    { name: "name", label: "Unit Name", placeholder: "Unit name" },
                    { name: "symbol", label: "Symbol", placeholder: "Symbol / short name" },
                    { name: "decimalPlaces", label: "Decimals", type: "number", placeholder: "Decimal places" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/create/godown"
              element={
                <MasterDataPage
                  title="Godowns"
                  subtitle="Create godowns or locations for stock receipt, issue, and transfer."
                  endpoint="godowns"
                  fields={[
                    { name: "name", label: "Godown Name", placeholder: "Godown name" },
                    { name: "alias", label: "Alias", placeholder: "Alias" },
                    { name: "address", label: "Address", placeholder: "Address" },
                  ]}
                />
              }
            />
            <Route
              path="/masters/alter/godown"
              element={
                <MasterDataPage
                  title="Godowns"
                  subtitle="Alter storage locations used across inventory entries."
                  endpoint="godowns"
                  fields={[
                    { name: "name", label: "Godown Name", placeholder: "Godown name" },
                    { name: "alias", label: "Alias", placeholder: "Alias" },
                    { name: "address", label: "Address", placeholder: "Address" },
                  ]}
                />
              }
            />
            <Route path="/masters/create/price-list" element={<PriceLevels />} />
            <Route path="/masters/alter/price-list" element={<AlterItemPrices />} />

            <Route path="/chart-of-accounts/groups" element={<CoaGroups />} />
            <Route path="/chart-of-accounts/ledgers" element={<CoaLedgers />} />
            <Route path="/chart-of-accounts/voucher-types" element={<VoucherTypesPage />} />
            <Route
              path="/chart-of-accounts/currencies"
              element={
                <MasterDataPage
                  title="Currencies"
                  subtitle="Review currencies available for the selected company."
                  endpoint="currencies"
                  fields={[
                    { name: "code", label: "Code", placeholder: "Currency code" },
                    { name: "symbol", label: "Symbol", placeholder: "Currency symbol" },
                    { name: "name", label: "Name", placeholder: "Currency name" },
                    { name: "decimalPlaces", label: "Decimals", type: "number", placeholder: "Decimal places" },
                  ]}
                />
              }
            />
            <Route path="/chart-of-accounts/cost-centres" element={Placeholder("Chart of Accounts - Cost Centres", "Cost centre listing is scaffolded for future management reporting.")} />
            <Route path="/chart-of-accounts/stock-groups" element={<CoaStockGroups />} />
            <Route
              path="/chart-of-accounts/stock-categories"
              element={
                <MasterDataPage
                  title="Stock Categories"
                  subtitle="Review stock categories available for item classification."
                  endpoint="stock-categories"
                  parentOptionsEndpoint="stock-categories"
                  fields={[
                    { name: "name", label: "Name", placeholder: "Stock category name" },
                    { name: "parentId", label: "Parent Category", type: "select", placeholder: "Select parent category" },
                  ]}
                />
              }
            />
            <Route path="/chart-of-accounts/stock-items" element={<CoaStockItems />} />
            <Route
              path="/chart-of-accounts/units"
              element={
                <MasterDataPage
                  title="Units of Measure"
                  subtitle="Review units used in stock items and vouchers."
                  endpoint="units"
                  fields={[
                    { name: "name", label: "Unit Name", placeholder: "Unit name" },
                    { name: "symbol", label: "Symbol", placeholder: "Symbol / short name" },
                    { name: "decimalPlaces", label: "Decimals", type: "number", placeholder: "Decimal places" },
                  ]}
                />
              }
            />

            <Route path="/transactions/accounting/contra" element={<VoucherList initialVoucherName="Contra" />} />
            <Route path="/transactions/accounting/payment" element={<VoucherList initialVoucherName="Payment" />} />
            <Route path="/transactions/accounting/receipt" element={<VoucherList initialVoucherName="Receipt" />} />
            <Route path="/transactions/accounting/journal" element={<VoucherList initialVoucherName="Journal" />} />
            <Route path="/transactions/accounting/sales" element={<VoucherList initialVoucherName="Sales" />} />
            <Route path="/transactions/accounting/pos-voucher" element={<PosVoucherPage />} />
            <Route path="/transactions/accounting/purchase" element={<VoucherList initialVoucherName="Purchase" />} />
            <Route path="/transactions/accounting/credit-note" element={<VoucherList initialVoucherName="Credit Note" />} />
            <Route path="/transactions/accounting/debit-note" element={<VoucherList initialVoucherName="Debit Note" />} />
            <Route path="/transactions/inventory/receipt-note" element={<InventoryVoucherPage voucherName="Receipt Note" />} />
            <Route path="/transactions/inventory/delivery-note" element={<InventoryVoucherPage voucherName="Delivery Note" />} />
            <Route path="/transactions/inventory/rejections-in" element={Placeholder("Rejections In", "This screen is reserved for inward rejection vouchers and inventory returns.")} />
            <Route path="/transactions/inventory/rejections-out" element={Placeholder("Rejections Out", "This screen is reserved for outward rejection vouchers and inventory returns.")} />
            <Route path="/transactions/inventory/stock-journal" element={<InventoryVoucherPage voucherName="Stock Journal" />} />
            <Route path="/transactions/inventory/physical-stock" element={Placeholder("Physical Stock", "Physical stock entry is scaffolded for stock adjustment and verification workflows.")} />
            <Route path="/transactions/alter-vouchers" element={<VoucherRegister />} />
            <Route path="/transactions/alter-vouchers/:voucherId" element={<AlterVoucherEntryPage />} />

            <Route path="/banking/activities/cheque-printing" element={Placeholder("Cheque Printing", "Banking activity routing is in place for cheque layout and printing support.")} />
            <Route path="/banking/activities/deposit-slip" element={Placeholder("Deposit Slip", "Deposit slip support can be added here with bank-wise templates.")} />
            <Route path="/banking/activities/payment-advice" element={Placeholder("Payment Advice", "Payment advice routing is ready for bank communication workflows.")} />
            <Route path="/banking/activities/bank-reconciliation" element={Placeholder("Bank Reconciliation", "Bank reconciliation will fit here once statement import and matching rules are enabled.")} />
            <Route path="/banking/import/bank-statement" element={Placeholder("Import Bank Statement", "Bank statement import is scaffolded under the Tally-style banking structure.")} />
            <Route path="/banking/import/auto-reconciliation" element={Placeholder("Auto Reconciliation", "Automatic bank reconciliation can be added here after statement parsing is implemented.")} />

            <Route path="/reports/financial/balance-sheet" element={<BalanceSheetPage />} />
            <Route path="/reports/financial/profit-loss" element={<ProfitLoss />} />
            <Route path="/reports/financial/trial-balance" element={<TrialBalance />} />
            <Route path="/reports/financial/cash-flow" element={<CashFlowPage />} />
            <Route path="/reports/financial/fund-flow" element={Placeholder("Fund Flow", "Fund flow reporting is scaffolded and ready for a later reporting pass.")} />

            <Route path="/reports/inventory/stock-summary" element={<StockSummary />} />
            <Route path="/reports/inventory/stock-ageing" element={Placeholder("Stock Ageing", "Stock ageing routing is ready for batch-wise and age-bucket inventory analysis.")} />
            <Route path="/reports/inventory/movement-analysis" element={Placeholder("Movement Analysis", "Movement analysis can be added on top of stock vouchers and item history.")} />
            <Route path="/reports/inventory/reorder-status" element={Placeholder("Reorder Status", "Reorder status is scaffolded for stock policy and minimum-level reporting.")} />
            <Route path="/reports/inventory/batch-summary" element={Placeholder("Batch Summary", "Batch summary can be implemented when batch-level inventory tracking is enabled.")} />

            <Route path="/reports/ratio-analysis" element={Placeholder("Ratio Analysis", "Ratio analysis can be derived from balance sheet and profit & loss figures in the next reporting step.")} />
            <Route path="/reports/day-book" element={<DayBookPage />} />

            <Route
              path="/reports/account-books/cash-book"
              element={
                <VoucherBookPage
                  title="Cash Book"
                  subtitle="Review voucher entries impacting cash-in-hand accounts."
                  ledgerGroupNames={["Cash-in-Hand"]}
                />
              }
            />
            <Route
              path="/reports/account-books/bank-book"
              element={
                <VoucherBookPage
                  title="Bank Book"
                  subtitle="Review voucher entries affecting bank accounts."
                  ledgerGroupNames={["Bank Accounts"]}
                />
              }
            />
            <Route path="/reports/account-books/ledger" element={Placeholder("Ledger Book", "A dedicated ledger drilldown report can be added next with running balance and voucher drill-ins.")} />
            <Route path="/reports/account-books/group-summary" element={<TrialBalance />} />
            <Route path="/reports/account-books/ledger-detail" element={<LedgerDetailPage />} />
            <Route
              path="/reports/account-books/sales-register"
              element={
                <VoucherBookPage
                  title="Sales Register"
                  subtitle="View all sales vouchers for the selected period."
                  voucherNames={["Sales"]}
                />
              }
            />
            <Route
              path="/reports/account-books/purchase-register"
              element={
                <VoucherBookPage
                  title="Purchase Register"
                  subtitle="View all purchase vouchers for the selected period."
                  voucherNames={["Purchase"]}
                />
              }
            />
            <Route
              path="/reports/account-books/journal-register"
              element={
                <VoucherBookPage
                  title="Journal Register"
                  subtitle="Inspect journal vouchers over the selected period."
                  voucherNames={["Journal"]}
                />
              }
            />
            <Route
              path="/reports/account-books/debit-note-register"
              element={
                <VoucherBookPage
                  title="Debit Note Register"
                  subtitle="Review debit note vouchers over the selected period."
                  voucherNames={["Debit Note"]}
                />
              }
            />
            <Route
              path="/reports/account-books/credit-note-register"
              element={
                <VoucherBookPage
                  title="Credit Note Register"
                  subtitle="Review credit note vouchers over the selected period."
                  voucherNames={["Credit Note"]}
                />
              }
            />

            <Route path="/reports/inventory-books/stock-item" element={<StockItemDetailPage />} />
            <Route path="/reports/inventory-books/stock-group-summary" element={<StockGroupSummaryPage />} />
            <Route
              path="/reports/inventory-books/movement-analysis"
              element={<Navigate to="/reports/inventory-books/movement-analysis/stock-group" replace />}
            />
            <Route
              path="/reports/inventory-books/movement-analysis/stock-group"
              element={<InventoryMovementAnalysisPage variant="stock-group" />}
            />
            <Route
              path="/reports/inventory-books/movement-analysis/stock-category"
              element={<InventoryMovementAnalysisPage variant="stock-category" />}
            />
            <Route
              path="/reports/inventory-books/movement-analysis/stock-item"
              element={<InventoryMovementAnalysisPage variant="stock-item" />}
            />
            <Route
              path="/reports/inventory-books/movement-analysis/group"
              element={<InventoryMovementAnalysisPage variant="group" />}
            />
            <Route
              path="/reports/inventory-books/movement-analysis/ledger"
              element={<InventoryMovementAnalysisPage variant="ledger" />}
            />
            <Route path="/reports/inventory-books/godown-summary" element={Placeholder("Godown Summary", "Godown-wise stock summary is scaffolded for future warehouse-level reporting.")} />
            <Route path="/reports/inventory-books/batch-summary" element={Placeholder("Inventory Batch Summary", "Batch-wise stock reporting is reserved here for a later inventory enhancement.")} />

            <Route path="/reports/more/trial-balance-detailed" element={<TrialBalance />} />
            <Route path="/reports/more/day-book-filtered" element={<DayBookPage />} />
            <Route path="/reports/more/cash-flow-detailed" element={<CashFlowPage />} />
            <Route path="/reports/more/fund-flow" element={Placeholder("Fund Flow", "This detailed fund flow view is scaffolded under Display More Reports.")} />
            <Route path="/reports/more/receivables/bills-receivable" element={Placeholder("Bills Receivable", "Bills receivable reporting is placed here for a future bill-wise receivable workflow.")} />
            <Route path="/reports/more/receivables/bills-payable" element={Placeholder("Bills Payable", "Bills payable reporting is placed here for a future bill-wise payable workflow.")} />
            <Route path="/reports/more/receivables/outstanding-receivables" element={<OutstandingReportPage type="receivable" />} />
            <Route path="/reports/more/receivables/outstanding-payables" element={<OutstandingReportPage type="payable" />} />
            <Route path="/reports/more/exceptions/negative-stock" element={Placeholder("Negative Stock", "Negative stock exception reporting is scaffolded for inventory control.")} />
            <Route path="/reports/more/exceptions/overdue-receivables" element={Placeholder("Overdue Receivables", "Overdue receivable reporting can be added with due-date tracking.")} />
            <Route path="/reports/more/exceptions/overdue-payables" element={Placeholder("Overdue Payables", "Overdue payable reporting can be added with due-date tracking.")} />
            <Route path="/reports/more/exceptions/memorandum-vouchers" element={Placeholder("Memorandum Vouchers", "Memorandum voucher reporting is reserved for future non-posting entry support.")} />
            <Route path="/reports/more/cost-centres/cost-centre-summary" element={Placeholder("Cost Centre Summary", "Cost centre summary routing is in place for the next costing enhancement.")} />
            <Route path="/reports/more/cost-centres/cost-category-summary" element={Placeholder("Cost Category Summary", "Cost category summary can be added once parallel cost allocation is enabled.")} />
            <Route path="/reports/more/analysis/ratio-analysis" element={Placeholder("Analysis - Ratio Analysis", "Advanced analytical ratios can grow from the existing financial statement data.")} />
            <Route path="/reports/more/analysis/cash-funds-flow" element={Placeholder("Analysis - Cash/Funds Flow", "Cash and funds flow analysis is scaffolded here for a later reporting expansion.")} />
            <Route path="/reports/more/analysis/performance-analysis" element={Placeholder("Performance Analysis", "Performance analysis can be added here once comparative periods and ratio models are finalized.")} />
            <Route path="/reports/customer-behaviour/overview" element={<CustomerBehaviourOverviewPage />} />
            <Route path="/reports/customer-behaviour/product-wise" element={<ProductCustomerReportPage />} />
            <Route
              path="/reports/customer-behaviour/stock-group-wise"
              element={<CustomerDimensionReportPage title="Stock Group-wise Customer Report" endpoint="stock-group-wise" labelKey="groupName" />}
            />
            <Route
              path="/reports/customer-behaviour/category-wise"
              element={<CustomerDimensionReportPage title="Stock Category-wise Customer Report" endpoint="category-wise" labelKey="categoryName" />}
            />

            <Route path="/utilities/import-data" element={Placeholder("Import Data", "Utility routing is ready for structured import of masters and transactions.")} />
            <Route path="/utilities/export-data" element={Placeholder("Export Data", "Export utilities can be added here for reports and master data extraction.")} />
            <Route path="/utilities/banking-utilities" element={Placeholder("Banking Utilities", "Banking support utilities will be grouped here as that module expands.")} />
            <Route path="/utilities/data-verification" element={Placeholder("Data Verification", "Data verification utilities are scaffolded under the Tally-style utility area.")} />
            <Route path="/utilities/rewrite-data" element={Placeholder("Rewrite Data", "Rewrite data is reserved for maintenance and consistency operations.")} />
            <Route path="/utilities/split-company-data" element={Placeholder("Split Company Data", "Company data splitting can be introduced later as an administrative utility.")} />

            <Route path="/company/create" element={<CompanyList />} />
            <Route path="/company/alter" element={<CompanyList />} />
            <Route path="/company/select" element={<CompanyList />} />
            <Route path="/company/shut" element={Placeholder("Shut Company", "Company shutdown/close selection can be added as a workflow around active company context.")} />
            <Route path="/company/backup" element={Placeholder("Backup Company", "Backup routing is in place for export and archival workflows.")} />
            <Route path="/company/restore" element={Placeholder("Restore Company", "Restore routing is prepared for importing backed-up company datasets.")} />

            <Route path="*" element={Placeholder("Page Not Found", "This route does not exist in the current accounting workspace.")} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
