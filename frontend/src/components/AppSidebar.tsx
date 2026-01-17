import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  TrendingDown,
  Package,
  ShoppingCart,
  ShoppingBag,
  Warehouse,
  RotateCcw,
  BarChart3,
  Settings,
  FileText,
  Users,
  Building2,
  Tags,
  LogOut,
  UserCircle,
  ArrowLeftRight,
  HandCoins,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { AuthUser, signOut } from "@/lib/auth";
import { toast } from "sonner";

const menuItems = [
  { title: "Приход", url: "/income", icon: TrendingDown },
  { title: "Склад", url: "/warehouse", icon: Warehouse },
  { title: "Перемещение", url: "/movements", icon: ArrowLeftRight },
  { title: "Касса", url: "/pos", icon: ShoppingCart },
  { title: "Продажа", url: "/counterparty-sales", icon: ShoppingBag },
  { title: "Возврат", url: "/returns", icon: RotateCcw },
  { title: "Отчет", url: "/reports", icon: FileText },
  { title: "Отчет по прибыли", url: "/reports/profit", icon: FileText, adminOnly: true },
  { title: "Расход", url: "/expenses", icon: HandCoins, adminOnly: true },
  { title: "Анализ", url: "/analysis", icon: BarChart3, adminOnly: true },
];

const productionMenuItems = [
  { title: "Заказы", url: "/workshop/orders", icon: FileText },
  { title: "Склад (Цех)", url: "/workshop/stock", icon: Warehouse },
  { title: "Приход (Цех)", url: "/workshop/income", icon: TrendingDown },
  { title: "Производственные расходы", url: "/workshop/expenses", icon: HandCoins },
  { title: "Сотрудники (Цех)", url: "/workshop/employees", icon: Users },
  { title: "Зарплата", url: "/workshop/salary", icon: HandCoins, roles: ["admin", "production_manager"] },
  { title: "Отчет (Цех)", url: "/workshop/report", icon: FileText },
];

const systemItems = [
  { title: "Категории", url: "/categories", icon: Tags, adminOnly: false },
  { title: "Товары", url: "/products", icon: Package, adminOnly: false },
  { title: "Клиенты", url: "/clients", icon: UserCircle, adminOnly: false },
  { title: "Контрагенты", url: "/counterparties", icon: Users, adminOnly: true },
  { title: "Сотрудники", url: "/employees", icon: Users, adminOnly: true },
  { title: "Филиалы", url: "/branches", icon: Building2, adminOnly: true },
];

type AppSidebarProps = {
  user: AuthUser | null;
  lowStockCount?: number;
  isLoadingUser?: boolean;
};

export function AppSidebar({ user, lowStockCount, isLoadingUser = false }: AppSidebarProps) {
  const { open, openMobile, setOpenMobile } = useSidebar();
  const isSidebarOpen = open || openMobile;
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isSystemActive = systemItems.some((item) => currentPath === item.url);
  const isProductionActive = productionMenuItems.some((item) => currentPath === item.url);
  const isAdmin = user?.role === 'admin' || isLoadingUser;
  const isEmployee = user?.role === 'employee';
  const isProduction = user?.role === 'production_manager' || user?.role === 'manager';

  const allowedForEmployee = [
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
  const visibleMenuItems = user
    ? menuItems.filter((item) => {
        if (isProduction) return false;
        if (item.adminOnly && user.role !== "admin") return false;
        if (user.role === "employee") {
          return allowedForEmployee.includes(item.url);
        }
        return true;
      })
    : menuItems;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast.success("Вы вышли из системы");
    } catch (error) {
      toast.error("Ошибка при выходе");
    }
  };

  const handleNavigate = () => {
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r">
      <SidebarContent>
        <div className="p-4 border-b">
          {isSidebarOpen && (
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-sidebar-foreground">POS Система</h2>
              {user && (
                <div className="text-sm text-sidebar-foreground/80">
                  {user.name} •
                  {user.role === "admin"
                    ? " Администратор"
                    : user.role === "production_manager" || user.role === "manager"
                      ? " Менеджер производства"
                      : " Сотрудник"}
                </div>
              )}
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    className="hover:bg-sidebar-accent"
                    onClick={handleNavigate}
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <item.icon className="h-4 w-4" />
                    {isSidebarOpen && (
                        <span className="flex items-center gap-2">
                          {item.title}
                          {item.title === "Склад" && lowStockCount && lowStockCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                              {lowStockCount}
                            </span>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isProduction || isAdmin) && (
          <Collapsible
            defaultOpen={isProduction || isProductionActive}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="hover:bg-sidebar-accent">
                  <FileText className="h-4 w-4" />
                  {isSidebarOpen && (
                    <>
                      <span>Производство</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90 h-4 w-4" />
                    </>
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {productionMenuItems
                      .filter((item) => {
                        if (!item.roles) return true;
                        if (!user) return false;
                        return item.roles.includes(user.role);
                      })
                      .map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className="hover:bg-sidebar-accent"
                            onClick={handleNavigate}
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          >
                            <item.icon className="h-4 w-4" />
                            {isSidebarOpen && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {!isProduction && (
          <Collapsible defaultOpen={isSystemActive} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="hover:bg-sidebar-accent">
                  <Settings className="h-4 w-4" />
                  {isSidebarOpen && (
                    <>
                      <span>Система</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90 h-4 w-4" />
                    </>
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {systemItems
                      .filter((item) => {
                        if (item.adminOnly && !isAdmin) return false;
                        if (isEmployee) {
                          return ["/categories", "/products", "/clients"].includes(item.url);
                        }
                        return true;
                      })
                      .map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                            className="hover:bg-sidebar-accent"
                            onClick={handleNavigate}
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          >
                            <item.icon className="h-4 w-4" />
                            {isSidebarOpen && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  {isSidebarOpen && <span>Выход</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
