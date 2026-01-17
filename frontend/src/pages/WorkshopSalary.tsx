import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Gift, HandCoins } from "lucide-react";

interface SalarySummaryItem {
  employee_id: number;
  full_name: string;
  position?: string;
  accrued: number;
  payout: number;
  bonus: number;
  balance: number;
}

interface SalaryHistoryItem {
  id: string;
  date: string;
  employee_name: string;
  type: "accrual" | "payout" | "bonus";
  amount: number;
  note?: string;
  order_id?: number | null;
  created_by_name?: string | null;
}

const formatMonth = (value: Date) => value.toISOString().slice(0, 7);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value ?? 0);

const typeLabels: Record<SalaryHistoryItem["type"], string> = {
  accrual: "Начисление",
  payout: "Выплата",
  bonus: "Премия",
};

export default function WorkshopSalary() {
  const [month, setMonth] = useState(() => formatMonth(new Date()));
  const [summary, setSummary] = useState<SalarySummaryItem[]>([]);
  const [history, setHistory] = useState<SalaryHistoryItem[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"payout" | "bonus">("payout");
  const [selectedEmployee, setSelectedEmployee] = useState<SalarySummaryItem | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const employeeOptions = useMemo(
    () => summary.map((item) => ({ id: String(item.employee_id), label: item.full_name })),
    [summary],
  );

  const loadSummary = async () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    const data = await apiGet<SalarySummaryItem[]>(`/api/workshop/salary/summary?${params.toString()}`);
    setSummary(data);
  };

  const loadHistory = async (employeeId?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (employeeId && employeeId !== "all") {
      params.set("employee_id", employeeId);
    }
    const data = await apiGet<SalaryHistoryItem[]>(`/api/workshop/salary/history?${params.toString()}`);
    setHistory(data);
  };

  const load = async () => {
    try {
      await Promise.all([loadSummary(), loadHistory(employeeFilter)]);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить данные");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDialog = (type: "payout" | "bonus", employee: SalarySummaryItem) => {
    setDialogType(type);
    setSelectedEmployee(employee);
    setAmount("");
    setNote("");
    setDate("");
    setDialogOpen(true);
  };

  const saveTransaction = async () => {
    if (!selectedEmployee) return;
    const payload: Record<string, string | number | undefined> = {
      employee_id: selectedEmployee.employee_id,
      amount: Number(amount),
      note: note || undefined,
      date: date || undefined,
    };
    if (!payload.amount || payload.amount <= 0) {
      toast.error("Введите сумму больше нуля");
      return;
    }
    setIsSaving(true);
    try {
      const endpoint = dialogType === "payout" ? "/api/workshop/salary/payout" : "/api/workshop/salary/bonus";
      await apiPost(endpoint, payload);
      toast.success(dialogType === "payout" ? "Выплата сохранена" : "Премия сохранена");
      setDialogOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось сохранить транзакцию");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmployeeFilter = async (value: string) => {
    setEmployeeFilter(value);
    try {
      await loadHistory(value);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить историю");
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="grid gap-1">
          <span className="text-sm text-muted-foreground">Месяц</span>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[220px]" />
        </div>
        <Button onClick={load}>Обновить</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сотрудники</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Позиция</TableHead>
                <TableHead className="text-right">Начислено</TableHead>
                <TableHead className="text-right">Выдано</TableHead>
                <TableHead className="text-right">Баланс</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((item) => (
                <TableRow key={item.employee_id}>
                  <TableCell className="font-medium">{item.full_name}</TableCell>
                  <TableCell>{item.position || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.accrued)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.payout)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" onClick={() => openDialog("payout", item)}>
                        <HandCoins className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => openDialog("bonus", item)}>
                        <Gift className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>История транзакций</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Select value={employeeFilter} onValueChange={handleEmployeeFilter}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Сотрудник" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {employeeOptions.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead>Заказ</TableHead>
                <TableHead>Создал</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.date ? new Date(item.date).toLocaleString("ru-RU") : "—"}</TableCell>
                  <TableCell>{item.employee_name}</TableCell>
                  <TableCell>{typeLabels[item.type]}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  <TableCell>{item.note || "—"}</TableCell>
                  <TableCell>{item.order_id ? `#${item.order_id}` : "—"}</TableCell>
                  <TableCell>{item.created_by_name || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "payout" ? "Рассчитаться" : "Добавить премию"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="text-sm text-muted-foreground">
              {selectedEmployee ? selectedEmployee.full_name : ""}
            </div>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Сумма"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="Дата"
            />
            <Input placeholder="Комментарий" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveTransaction} disabled={isSaving}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
