import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Expense {
  id: number;
  title: string;
  amount: number;
  created_at: string;
}

export default function ProductionExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("0");

  const loadExpenses = async () => {
    try {
      const data = await apiGet<Expense[]>("/api/production/expenses");
      setExpenses(data);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить расходы");
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const createExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiPost("/api/production/expenses", { title, amount: Number(amount) || 0 });
      toast.success("Расход добавлен");
      setTitle("");
      setAmount("0");
      loadExpenses();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось добавить расход");
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Новый расход</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={createExpense}>
            <Input placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input type="number" step="0.01" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button type="submit">Сохранить</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Расходы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {expenses.map((expense) => (
            <div key={expense.id} className="border rounded p-2 text-sm flex justify-between">
              <div>
                <div className="font-medium">{expense.title}</div>
                <div className="text-muted-foreground text-xs">{new Date(expense.created_at).toLocaleDateString()}</div>
              </div>
              <div>{expense.amount}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
