import { apiGet, apiPost } from "@/api/client";
import { IncomePageBase, IncomeBranch, IncomeProduct, IncomeRecord, IncomeSubmitItem } from "@/components/IncomePageBase";

export default function Income() {
  const fetchBranches = () => apiGet<IncomeBranch[]>("/api/branches");
  const fetchProducts = () => apiGet<IncomeProduct[]>("/api/products");
  const fetchIncomes = (branchId?: number) => apiGet<IncomeRecord[]>(`/api/income${branchId ? `?branch_id=${branchId}` : ""}`);

  const submitIncome = (payload: { branch_id: number; items: IncomeSubmitItem[] }) => apiPost("/api/income", payload);

  return (
    <IncomePageBase
      title="Приход"
      description="Приход товаров на склад"
      branchSelector="selectable"
      fetchBranches={fetchBranches}
      fetchProducts={fetchProducts}
      fetchIncomes={fetchIncomes}
      submitIncome={submitIncome}
    />
  );
}
