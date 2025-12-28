import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { apiDelete, apiGet, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Expense = {
  id: number;
  title: string;
  amount: number;
  created_at: string;
  created_by_name?: string | null;
};

const formatDateTime = (value: string) => new Date(value).toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);

export default function Expenses() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const [formData, setFormData] = useState({ title: "", amount: "" });
  const [dateRange, setDateRange] = useState({ start: today(), end: today() });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = useMemo(() => formData.title.trim() !== "", [formData.title]);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.append("start_date", dateRange.start);
      if (dateRange.end) params.append("end_date", dateRange.end);
      const data = await apiGet<Expense[]>(`/api/expenses?${params.toString()}`);
      setExpenses(data.map((item) => ({ ...item, amount: item.amount ?? 0 })));
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Не удалось загрузить расходы");
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.end, dateRange.start]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchExpenses();
  }, [fetchExpenses, isAdmin]);

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast.error("Введите название расхода");
      return;
    }
    const amountValue = Math.max(0, parseFloat(formData.amount) || 0);
    setIsSubmitting(true);
    try {
      await apiPost("/api/expenses", {
        title: formData.title.trim(),
        amount: amountValue,
      });
      toast.success("Расход сохранен");
      setFormData({ title: "", amount: "" });
      fetchExpenses();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Не удалось сохранить расход");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Удалить расход?")) return;
    try {
      await apiDelete(`/api/expenses/${id}`);
      setExpenses((prev) => prev.filter((item) => item.id !== id));
      toast.success("Удалено");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Не удалось удалить расход");
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground">Раздел доступен только администраторам.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Расход</h1>
        <p className="text-muted-foreground">Учет операционных расходов</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Добавить расход</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Название расхода</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Например, аренда"
            />
          </div>
          <div>
            <Label>Сумма</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              min={0}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? "Сохранение..." : "Сохранить"}
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
          <Button variant="outline" onClick={fetchExpenses} disabled={isLoading}>
            Обновить
          </Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Загрузка...</div>
        ) : expenses.length === 0 ? (
          <div className="text-muted-foreground">Нет расходов за выбранный период</div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center gap-3 rounded-lg border p-3 shadow-sm"
              >
                <div className="flex-1">
                  <div className="font-medium">{expense.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(expense.created_at)}
                    {expense.created_by_name ? ` • ${expense.created_by_name}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{expense.amount.toFixed(2)} ₸</div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(expense.id)}
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
