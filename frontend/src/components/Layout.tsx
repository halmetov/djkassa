import { useState, useEffect, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { apiGet } from "@/api/client";
import { AuthUser, getCurrentUser } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

export const Layout = () => {
  const [open, setOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [lowStockCount, setLowStockCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

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
    "/reports",
  ];
  const productionAllowedRoutes = [
    "/workshop/orders",
    "/workshop/expenses",
    "/workshop/stock",
    "/workshop/income",
    "/workshop/employees",
    "/workshop/report",
  ];

  const isPathAllowed = (path: string, allowed: string[]) =>
    allowed.some((route) => path === route || path.startsWith(`${route}/`));

  const toggleSidebar = () => setMobileSidebarOpen((prev) => !prev);
  const closeSidebar = () => setMobileSidebarOpen(false);

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
    if (
      (user?.role === "production_manager" || user?.role === "manager") &&
      !isPathAllowed(location.pathname, productionAllowedRoutes)
    ) {
      navigate("/workshop/orders", { replace: true });
    }
  }, [location.pathname, navigate, user?.role]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileSidebarOpen]);

  const effectiveSidebarOpen = isMobile ? mobileSidebarOpen : open;

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
      <div
        className="min-h-screen flex w-full bg-background"
        style={{ "--navbar-height": "3.5rem" } as CSSProperties}
      >
        {(open || mobileSidebarOpen) && (
          <div
            className={`${mobileSidebarOpen ? "block" : "hidden md:block"} ${
              open ? "md:w-auto" : "md:w-0 md:min-w-0 md:overflow-hidden"
            } transition-[width] duration-200 relative z-40 md:z-auto`}
          >
            <AppSidebar
              user={user}
              isLoadingUser={isLoadingUser}
              lowStockCount={lowStockCount}
              isOpen={effectiveSidebarOpen}
              onClose={closeSidebar}
            />
          </div>
        )}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={closeSidebar}
            aria-label="Закрыть меню"
          />
        )}
        <main className="flex-1 flex flex-col">
          <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b bg-card flex items-center px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden relative z-50"
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
          <div className="flex-1 p-4 lg:p-6 pt-[calc(var(--navbar-height)+1rem)] lg:pt-[calc(var(--navbar-height)+1.5rem)]">
            <Outlet context={{ user, isAdmin }} />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
