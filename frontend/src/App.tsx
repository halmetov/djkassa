import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Auth from "./pages/Auth";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Employees from "./pages/Employees";
import Branches from "./pages/Branches";
import Clients from "./pages/Clients";
import Counterparties from "./pages/Counterparties";
import CounterpartySales from "./pages/CounterpartySales";
import Income from "./pages/Income";
import POS from "./pages/POS";
import Warehouse from "./pages/Warehouse";
import Reports from "./pages/Reports";
import Returns from "./pages/Returns";
import Analysis from "./pages/Analysis";
import ProfitReport from "./pages/ProfitReport";
import NotFound from "./pages/NotFound";
import Movements from "./pages/Movements";
import Expenses from "./pages/Expenses";
import WorkshopOrders from "./pages/WorkshopOrders";
import WorkshopOrderDetail from "./pages/WorkshopOrderDetail";
import WorkshopEmployees from "./pages/WorkshopEmployees";
import WorkshopStock from "./pages/WorkshopStock";
import WorkshopIncome from "./pages/WorkshopIncome";
import WorkshopExpenses from "./pages/WorkshopExpenses";
import WorkshopReport from "./pages/WorkshopReport";
import WorkshopSalary from "./pages/WorkshopSalary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Income />} />
            <Route path="/income" element={<Income />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/counterparty-sales" element={<CounterpartySales />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/profit" element={<ProfitReport />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/movements" element={<Movements />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/workshop/orders" element={<WorkshopOrders />} />
            <Route path="/workshop/orders/:id" element={<WorkshopOrderDetail />} />
            <Route path="/workshop/expenses" element={<WorkshopExpenses />} />
            <Route path="/workshop/stock" element={<WorkshopStock />} />
            <Route path="/workshop/income" element={<WorkshopIncome />} />
            <Route path="/workshop/employees" element={<WorkshopEmployees />} />
            <Route path="/workshop/salary" element={<WorkshopSalary />} />
            <Route path="/workshop/report" element={<WorkshopReport />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/products" element={<Products />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/branches" element={<Branches />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/counterparties" element={<Counterparties />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
