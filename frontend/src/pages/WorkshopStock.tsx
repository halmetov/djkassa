import { apiGet } from "@/api/client";
import { StockPageBase } from "@/components/StockPageBase";

type WorkshopBranch = { id: number; name: string };

export default function WorkshopStock() {
  const fetchBranch = async (): Promise<WorkshopBranch[]> => {
    const branch = await apiGet<WorkshopBranch>("/api/workshop/branch");
    return [branch];
  };

  const fetchStock = async (_branchId?: string) => {
    const data = await apiGet<{ product_id: number; name: string; available_qty: number; limit?: number | null }[]>(
      "/api/workshop/stock",
    );
    return data.map((item) => ({
      id: item.product_id,
      name: item.name,
      quantity: item.available_qty as number,
      limit: item.limit ?? null,
      purchase_price: null,
    }));
  };

  const fetchLowStock = async (_branchId?: string | null) => {
    const branch = await apiGet<WorkshopBranch>("/api/workshop/branch");
    const params = new URLSearchParams();
    params.set("branch_id", String(branch.id));
    return apiGet(`/api/products/low-stock?${params.toString()}`);
  };

  return (
    <StockPageBase
      title="Склад (Цех)"
      description="Остатки товаров в цехе"
      branchSelector="fixed"
      fetchBranches={fetchBranch}
      fetchStock={fetchStock}
      fetchLowStock={fetchLowStock}
      fixedBranchId={undefined}
      fixedBranchName="Цех"
    />
  );
}
