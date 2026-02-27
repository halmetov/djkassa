import { apiGet, apiPost } from "@/api/client";
import { IncomePageBase, IncomeBranch, IncomeProduct, IncomeRecord, IncomeSubmitItem } from "@/components/IncomePageBase";

export default function WorkshopIncome() {
  const fetchBranches = async () => {
    const branch = await apiGet<IncomeBranch>("/api/workshop/branch");
    return [branch];
  };

  const fetchProducts = () => apiGet<IncomeProduct[]>("/api/workshop/products?limit=2000");
  const fetchIncomes = (branchId?: number) =>
    apiGet<IncomeRecord[]>(`/api/income${branchId ? `?branch_id=${branchId}` : ""}`);

  const submitIncome = (payload: { branch_id: number; items: IncomeSubmitItem[] }) =>
    apiPost("/api/workshop/income", { items: payload.items });

  return (
    <IncomePageBase
      title="Приход (Цех)"
      description="Приход товаров в цех"
      branchSelector="fixed"
      fetchBranches={fetchBranches}
      fetchProducts={fetchProducts}
      fetchIncomes={fetchIncomes}
      submitIncome={submitIncome}
      fixedBranchName="Цех"
    />
  );
}
