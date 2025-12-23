import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { apiGet } from "@/api/client";
import { AuthUser, getCurrentUser } from "@/lib/auth";

export const Layout = () => {
  const [open, setOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [lowStockCount, setLowStockCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const employeeAllowedRoutes = [
    "/",
    "/pos",
    "/warehouse",
    "/income",
    "/returns",
    "/categories",
    "/products",
    "/movements",
    "/clients",
    "/employees",
    "/branches",
  ];

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("sidebar-open") : null;
    if (saved !== null) {
      setOpen(saved === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar-open", String(open));
    }
  }, [open]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authUser = await getCurrentUser();
        if (!authUser) {
          setIsLoadingUser(false);
          navigate('/auth');
          return;
        }
        setUser(authUser);
      } catch (error: any) {
        console.error("Failed to load current user", error);
        navigate('/auth');
      } finally {
        setIsLoadingUser(false);
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (user?.role === "employee" && !employeeAllowedRoutes.includes(location.pathname)) {
      navigate("/pos", { replace: true });
    }
  }, [location.pathname, navigate, user?.role]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const loadLowStock = async () => {
      try {
        const items = await apiGet<{ id: number }[]>("/api/products/low-stock");
        setLowStockCount(items.length);
      } catch (error) {
        // ignore errors silently in layout
      }
    };

    if (user) {
      loadLowStock();
    }
  }, [user]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          user={user}
          isLoadingUser={isLoadingUser}
          lowStockCount={lowStockCount}
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
        />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={(event) => {
                event.stopPropagation();
                toggleSidebar();
              }}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setOpen((prev) => !prev)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </header>
          <div className="flex-1 p-4 lg:p-6">
            <Outlet context={{ user, isAdmin }} />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
