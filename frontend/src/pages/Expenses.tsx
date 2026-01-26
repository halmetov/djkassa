import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { apiDelete, apiGet, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Expense = {
  id: number;
  title: string;
  amount: number;
  created_at: string;
  created_by_name?: string | null;
};

type SalaryEmployee = {
  id: number;
  name: string;
};

type SalaryPayment = {
  id: number;
  employee: SalaryEmployee;
  payment_type: "advance" | "salary";
  amount: number;
  comment?: string | null;
  created_at: string;
  created_by_admin: SalaryEmployee;
};

type SalaryPaymentList = {
  items: SalaryPayment[];
  total_amount: number;
};

const formatDateTime = (value: string) => new Date(value).toLocaleString();
const formatAlmatyDateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => {
  const almatyNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Almaty" }));
  return almatyNow.toISOString().slice(0, 7);
};

export default function Expenses() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const [formData, setFormData] = useState({ title: "", amount: "" });
  const [dateRange, setDateRange] = useState({ start: today(), end: today() });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<SalaryEmployee[]>([]);
  const [salaryForm, setSalaryForm] = useState({
    employeeId: "",
    paymentType: "advance",
    amount: "",
    comment: "",
  });
  const [salaryMonth, setSalaryMonth] = useState(currentMonth());
  const [salaryEmployeeFilter, setSalaryEmployeeFilter] = useState("all");
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [salaryTotal, setSalaryTotal] = useState(0);
  const [isSalaryLoading, setIsSalaryLoading] = useState(false);
  const [isSalarySubmitting, setIsSalarySubmitting] = useState(false);

  const isFormValid = useMemo(() => formData.title.trim() !== "", [formData.title]);
  const isSalaryFormValid = useMemo(
    () => salaryForm.employeeId !== "" && (parseFloat(salaryForm.amount) || 0) > 0,
    [salaryForm.amount, salaryForm.employeeId]
  );

  const formatErrorMessage = (error: any, fallback: string) => {
    if (!error) return fallback;
    const bodyDetail = typeof error?.body === "object" ? error.body?.detail : undefined;
    if (bodyDetail) {
      return `${fallback}: ${bodyDetail}`;
    }
    return error?.message || fallback;
  };

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.append("start_date", dateRange.start);
      if (dateRange.end) params.append("end_date", dateRange.end);
      const query = params.toString();
      const path = query ? `/api/expenses?${query}` : "/api/expenses";
      const data = await apiGet<Expense[]>(path);
      setExpenses(data.map((item) => ({ ...item, amount: item.amount ?? 0 })));
    } catch (error: any) {
      console.error(error);
      toast.error(formatErrorMessage(error, "Не удалось загрузить расходы"));
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.end, dateRange.start]);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await apiGet<SalaryEmployee[]>("/api/admin/employees");
      setEmployees(data);
    } catch (error: any) {
      console.error(error);
      toast.error(formatErrorMessage(error, "Не удалось загрузить список сотрудников"));
    }
  }, []);

  const fetchSalaryPayments = useCallback(async () => {
    setIsSalaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (salaryMonth) params.append("month", salaryMonth);
      if (salaryEmployeeFilter !== "all") params.append("employee_id", salaryEmployeeFilter);
      const path = params.toString()
        ? `/api/admin/salary-payments?${params.toString()}`
        : "/api/admin/salary-payments";
      const data = await apiGet<SalaryPaymentList>(path);
      setSalaryPayments(data.items.map((item) => ({ ...item, amount: item.amount ?? 0 })));
      setSalaryTotal(data.total_amount ?? 0);
    } catch (error: any) {
      console.error(error);
      toast.error(formatErrorMessage(error, "Не удалось загрузить историю выплат"));
    } finally {
      setIsSalaryLoading(false);
    }
  }, [salaryEmployeeFilter, salaryMonth]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchExpenses();
  }, [fetchExpenses, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchEmployees();
  }, [fetchEmployees, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchSalaryPayments();
  }, [fetchSalaryPayments, isAdmin]);

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast.error("Введите название расхода");
      return;
    }
    const amountValue = Math.max(0, parseFloat(formData.amount) || 0);
    setIsSubmitting(true);
    try {
      await apiPost<Expense>("/api/expenses", {
        title: formData.title.trim(),
        amount: amountValue,
      });
      toast.success("Расход сохранен");
      setFormData({ title: "", amount: "" });
      fetchExpenses();
    } catch (error: any) {
      console.error(error);
      toast.error(formatErrorMessage(error, "Не удалось сохранить расход"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSalarySubmit = async () => {
    if (!isSalaryFormValid) {
      toast.error("Заполните сотрудника и сумму");
      return;
    }
    const amountValue = parseFloat(salaryForm.amount) || 0;
    if (amountValue <= 0) {
      toast.error("Сумма должна быть больше 0");
      return;
    }
    setIsSalarySubmitting(true);
    try {
      await apiPost<SalaryPayment>("/api/admin/salary-payments", {
        employee_id: Number(salaryForm.employeeId),
        payment_type: salaryForm.paymentType,
        amount: amountValue,
        comment: salaryForm.comment.trim() || null,
      });
      toast.success("Выплата сохранена");
      setSalaryForm((prev) => ({ ...prev, amount: "", comment: "" }));
      fetchSalaryPayments();
    } catch (error: any) {
      console.error(error);
      toast.error(formatErrorMessage(error, "Не удалось сохранить выплату"));
    } finally {
      setIsSalarySubmitting(false);
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

      <Tabs defaultValue="expenses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="expenses">Расходы</TabsTrigger>
          <TabsTrigger value="salary">Зарплата</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="salary" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Выдать зарплату</h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div>
                <Label>Сотрудник</Label>
                <Select
                  value={salaryForm.employeeId}
                  onValueChange={(value) => setSalaryForm((prev) => ({ ...prev, employeeId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите сотрудника" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Нет доступных сотрудников
                      </SelectItem>
                    ) : (
                      employees.map((employee) => (
                        <SelectItem key={employee.id} value={String(employee.id)}>
                          {employee.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Тип выплаты</Label>
                <Select
                  value={salaryForm.paymentType}
                  onValueChange={(value) => setSalaryForm((prev) => ({ ...prev, paymentType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Тип выплаты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Аванс</SelectItem>
                    <SelectItem value="salary">Зарплата</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Сумма</Label>
                <Input
                  type="number"
                  min={0}
                  value={salaryForm.amount}
                  onChange={(e) => setSalaryForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Комментарий</Label>
                <Textarea
                  value={salaryForm.comment}
                  onChange={(e) => setSalaryForm((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder="Комментарий (опционально)"
                />
              </div>
              <Button onClick={handleSalarySubmit} disabled={!isSalaryFormValid || isSalarySubmitting}>
                {isSalarySubmitting ? "Сохранение..." : "Выдать"}
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Месяц</Label>
                  <Input
                    type="month"
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Сотрудник</Label>
                  <Select
                    value={salaryEmployeeFilter}
                    onValueChange={(value) => setSalaryEmployeeFilter(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Все сотрудники" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все сотрудники</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={String(employee.id)}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" onClick={fetchSalaryPayments} disabled={isSalaryLoading}>
                Обновить
              </Button>
            </div>

            <div className="text-sm font-medium">
              Общий расход по зарплате за период: {salaryTotal.toFixed(2)} ₸
            </div>

            {isSalaryLoading ? (
              <div className="text-muted-foreground">Загрузка...</div>
            ) : salaryPayments.length === 0 ? (
              <div className="text-muted-foreground">Нет выплат за выбранный период</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Дата/время</th>
                      <th className="py-2 pr-4 font-medium">Сотрудник</th>
                      <th className="py-2 pr-4 font-medium">Тип</th>
                      <th className="py-2 pr-4 font-medium">Сумма</th>
                      <th className="py-2 pr-4 font-medium">Комментарий</th>
                      <th className="py-2 font-medium">Кто выдал</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryPayments.map((payment) => (
                      <tr key={payment.id} className="border-t">
                        <td className="py-2 pr-4">{formatAlmatyDateTime(payment.created_at)}</td>
                        <td className="py-2 pr-4">{payment.employee.name}</td>
                        <td className="py-2 pr-4">
                          {payment.payment_type === "advance" ? "Аванс" : "Зарплата"}
                        </td>
                        <td className="py-2 pr-4">{payment.amount.toFixed(2)} ₸</td>
                        <td className="py-2 pr-4">{payment.comment || "—"}</td>
                        <td className="py-2">{payment.created_by_admin.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
