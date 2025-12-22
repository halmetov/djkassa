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
import Income from "./pages/Income";
import POS from "./pages/POS";
import Warehouse from "./pages/Warehouse";
import Reports from "./pages/Reports";
import Returns from "./pages/Returns";
import Analysis from "./pages/Analysis";
import NotFound from "./pages/NotFound";

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
            <Route path="/reports" element={<Reports />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/products" element={<Products />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/branches" element={<Branches />} />
            <Route path="/clients" element={<Clients />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
