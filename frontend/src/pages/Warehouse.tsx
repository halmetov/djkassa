import { useOutletContext } from "react-router-dom";
import { apiGet } from "@/api/client";
import { StockPageBase, BranchOption } from "@/components/StockPageBase";

export default function Warehouse() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const fetchBranches = async (): Promise<BranchOption[]> => {
    const data = await apiGet<BranchOption[]>("/api/branches");
    return data.filter((branch) => (branch as any).active !== false).map((branch) => ({
      id: String(branch.id),
      name: branch.name,
    }));
  };

  const fetchStock = async (branchId: string) => {
    const data = await apiGet<{ id: number; product: string; quantity: number; limit?: number | null; purchase_price?: number | null }[]>(`/api/branches/${branchId}/stock`);
    return data.map((item) => ({
      id: item.id,
      name: item.product,
      quantity: item.quantity,
      limit: item.limit,
      purchase_price: item.purchase_price ?? 0,
    }));
  };

  const fetchLowStock = async (branchId: string | null) => {
    const params = new URLSearchParams();
    if (branchId) {
      params.set("branch_id", branchId);
    }
    const data = await apiGet<{ id: number; name: string; branch: string; quantity: number; limit: number }[]>(
      `/api/products/low-stock${params.toString() ? `?${params.toString()}` : ""}`,
    );
    return data;
  };

  return (
    <StockPageBase
      title="Склад"
      description="Остатки товаров"
      branchSelector="selectable"
      fetchBranches={fetchBranches}
      fetchStock={fetchStock}
      fetchLowStock={fetchLowStock}
      showPurchaseTotal={isAdmin}
    />
  );
}
