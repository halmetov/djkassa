import { useState, useEffect, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { apiGet } from "@/api/client";
import { AuthUser, getCurrentUser } from "@/lib/auth";

export const Layout = () => {
  const HEADER_HEIGHT = "64px";
  const [open, setOpen] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [lowStockCount, setLowStockCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const employeeAllowedRoutes = [
    "/",
    "/pos",
    "/counterparty-sales",
    "/warehouse",
    "/income",
    "/returns",
    "/categories",
    "/products",
    "/movements",
    "/clients",
    "/reports",
  ];
  const productionManagerAllowedRoutes = [
    "/workshop/orders",
    "/workshop/expenses",
    "/workshop/stock",
    "/workshop/income",
    "/workshop/employees",
    "/workshop/report",
    "/workshop/salary",
  ];
  const productionAllowedRoutes = productionManagerAllowedRoutes.filter(
    (route) => route !== "/workshop/salary",
  );

  const isPathAllowed = (path: string, allowed: string[]) =>
    allowed.some((route) => path === route || path.startsWith(`${route}/`));

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
    if (user?.role === "production_manager" && !isPathAllowed(location.pathname, productionManagerAllowedRoutes)) {
      navigate("/workshop/orders", { replace: true });
    }
    if (user?.role === "manager" && !isPathAllowed(location.pathname, productionAllowedRoutes)) {
      navigate("/workshop/orders", { replace: true });
    }
  }, [location.pathname, navigate, user?.role]);

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
      <LayoutShell
        headerHeight={HEADER_HEIGHT}
        user={user}
        isLoadingUser={isLoadingUser}
        lowStockCount={lowStockCount}
        isAdmin={user?.role === "admin"}
      />
    </SidebarProvider>
  );
};

type LayoutShellProps = {
  headerHeight: string;
  user: AuthUser | null;
  isLoadingUser: boolean;
  lowStockCount: number;
  isAdmin: boolean;
};

const LayoutShell = ({ headerHeight, user, isLoadingUser, lowStockCount, isAdmin }: LayoutShellProps) => {
  const { isMobile, open: sidebarOpen, openMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const location = useLocation();
  const sidebarOffset = !isMobile && sidebarOpen ? "var(--sidebar-width)" : "0px";

  useEffect(() => {
    document.documentElement.style.setProperty("--navbar-height", headerHeight);
    return () => {
      document.documentElement.style.removeProperty("--navbar-height");
    };
  }, [headerHeight]);

  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  useEffect(() => {
    if (!openMobile) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [openMobile]);

  return (
    <div
      className="flex min-h-screen w-full bg-background"
      style={
        {
          "--navbar-height": headerHeight,
          "--sidebar-offset": sidebarOffset,
        } as CSSProperties
      }
    >
      <AppSidebar user={user} isLoadingUser={isLoadingUser} lowStockCount={lowStockCount} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header
          className="fixed top-0 right-0 z-40 flex h-[var(--navbar-height)] items-center gap-2 border-b bg-card px-4 lg:px-6"
          style={{ left: "var(--sidebar-offset)" } as CSSProperties}
        >
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        <main className="min-w-0 flex-1 pt-[var(--navbar-height)]">
          <div className="flex-1 p-4 lg:p-6">
            <Outlet context={{ user, isAdmin }} />
          </div>
        </main>
      </div>
    </div>
  );
};
