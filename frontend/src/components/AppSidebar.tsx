import { useEffect, useRef } from "react";
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
  { title: "Касса", url: "/pos", icon: ShoppingCart },
  { title: "Возврат", url: "/returns", icon: RotateCcw },
  { title: "Отчет", url: "/reports", icon: FileText, adminOnly: true },
  { title: "Анализ", url: "/analysis", icon: BarChart3, adminOnly: true },
];

const systemItems = [
  { title: "Категории", url: "/categories", icon: Tags, adminOnly: false },
  { title: "Товары", url: "/products", icon: Package, adminOnly: false },
  { title: "Сотрудники", url: "/employees", icon: Users, adminOnly: true },
  { title: "Филиалы", url: "/branches", icon: Building2, adminOnly: true },
  { title: "Клиенты", url: "/clients", icon: UserCircle, adminOnly: false },
];

type AppSidebarProps = {
  user: AuthUser | null;
  lowStockCount?: number;
  isOpen: boolean;
  onClose: () => void;
};

export function AppSidebar({ user, lowStockCount, isOpen, onClose }: AppSidebarProps) {
  const { open, openMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const previousOpenMobile = useRef(openMobile);

  const isSystemActive = systemItems.some((item) => currentPath === item.url);
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  const allowedForEmployee = ["/pos", "/warehouse", "/income", "/returns", "/categories", "/products"];
  const visibleMenuItems = user
    ? menuItems.filter((item) => {
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

  useEffect(() => {
    setOpenMobile(isOpen);
  }, [isOpen, setOpenMobile]);

  useEffect(() => {
    if (previousOpenMobile.current && !openMobile) {
      onClose();
    }
    previousOpenMobile.current = openMobile;
  }, [onClose, openMobile]);

  const handleNavigate = () => {
    onClose();
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <div className="p-4 border-b">
          {open && (
            <h2 className="text-lg font-bold text-sidebar-foreground">POS Система</h2>
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
                    {open && (
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

        <Collapsible defaultOpen={isSystemActive} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="hover:bg-sidebar-accent">
                <Settings className="h-4 w-4" />
                {open && (
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
                            {open && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  {open && <span>Выход</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
