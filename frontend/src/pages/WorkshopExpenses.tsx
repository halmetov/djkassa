import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiGet, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkshopExpense = {
  id: number;
  title: string;
  amount: number;
  branch_id?: number | null;
  created_at?: string | null;
  created_by_name?: string | null;
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "Дата не указана";
const today = () => new Date().toISOString().slice(0, 10);

export default function WorkshopExpenses() {
  const [formData, setFormData] = useState({ title: "", amount: "" });
  const [dateRange, setDateRange] = useState({ start: today(), end: today() });
  const queryClient = useQueryClient();

  const isFormValid = useMemo(() => formData.title.trim() !== "", [formData.title]);

  const formatErrorMessage = (error: any, fallback: string) => {
    if (!error) return fallback;
    const bodyDetail = typeof error?.body === "object" ? error.body?.detail : undefined;
    if (bodyDetail) {
      return `${fallback}: ${bodyDetail}`;
    }
    return error?.message || fallback;
  };

  const fetchExpenses = async (): Promise<WorkshopExpense[]> => {
    const params = new URLSearchParams();
    if (dateRange.start) params.append("start_date", dateRange.start);
    if (dateRange.end) params.append("end_date", dateRange.end);
    const query = params.toString();
    const path = query ? `/api/workshop/expenses?${query}` : "/api/workshop/expenses";
    const data = await apiGet<WorkshopExpense[]>(path);
    return data.map((item) => ({ ...item, amount: Number(item.amount ?? 0) }));
  };

  const {
    data: expenses = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["workshop-expenses", dateRange.start, dateRange.end],
    queryFn: fetchExpenses,
  });

  const createExpense = useMutation({
    mutationFn: async () => {
      const amountValue = Math.max(0, parseFloat(formData.amount) || 0);
      return apiPost<WorkshopExpense>("/api/workshop/expenses", {
        title: formData.title.trim(),
        amount: amountValue,
      });
    },
    onSuccess: () => {
      toast.success("Расход сохранен");
      setFormData({ title: "", amount: "" });
      queryClient.invalidateQueries({ queryKey: ["workshop-expenses"] });
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(formatErrorMessage(error, "Не удалось сохранить расход цеха"));
    },
  });

  const handleSubmit = () => {
    if (!isFormValid) {
      toast.error("Введите название расхода");
      return;
    }
    createExpense.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Расход (Цех)</h1>
        <p className="text-muted-foreground">
          Списания с фиксированным филиалом цеха. Сразу после сохранения данные обновляются.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <CardHeader className="p-0">
          <CardTitle>Новый расход</CardTitle>
          <CardDescription>Сохраняется только для филиала «Цех».</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Название расхода</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Например, аренда станка"
            />
          </div>
          <div>
            <Label>Сумма</Label>
            <Input
              type="number"
              min={0}
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!isFormValid || createExpense.isLoading}>
            {createExpense.isLoading ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <Label>С даты</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <Label>По дату</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Обновить
          </Button>
        </div>

        {isFetching ? (
          <div className="text-muted-foreground">Загрузка...</div>
        ) : expenses.length === 0 ? (
          <div className="text-muted-foreground">Нет расходов за выбранный период</div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center gap-3 rounded-lg border p-3 shadow-sm">
                <div className="flex-1">
                  <div className="font-medium">{expense.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(expense.created_at)}
                    {expense.created_by_name ? ` • ${expense.created_by_name}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{expense.amount.toFixed(2)} ₸</div>
                  {expense.branch_id ? (
                    <div className="text-xs text-muted-foreground">Филиал #{expense.branch_id}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
