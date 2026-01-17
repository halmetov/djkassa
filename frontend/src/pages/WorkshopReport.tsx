import { useEffect, useState } from "react";
import { apiGet } from "@/api/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WorkshopReportSummary {
  month: string;
  orders_total: number;
  materials_cogs: number;
  orders_margin: number;
  expenses_total: number;
  salary_payout_total: number;
  salary_bonus_total: number;
  salary_total: number;
  net_profit: number;
}

const formatMonth = (value: Date) => value.toISOString().slice(0, 7);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value ?? 0);

export default function WorkshopReport() {
  const [summary, setSummary] = useState<WorkshopReportSummary | null>(null);
  const [month, setMonth] = useState(() => formatMonth(new Date()));

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      const data = await apiGet<WorkshopReportSummary>(`/api/workshop/reports/summary?${params.toString()}`);
      setSummary(data);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить отчет");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ordersTotal = summary?.orders_total ?? 0;
  const materialsCogs = summary?.materials_cogs ?? 0;
  const ordersMargin = summary?.orders_margin ?? 0;
  const expensesTotal = summary?.expenses_total ?? 0;
  const salaryTotal = summary?.salary_total ?? 0;

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 flex-wrap items-end">
        <div className="grid gap-1">
          <span className="text-sm text-muted-foreground">Месяц</span>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[220px]" />
        </div>
        <Button onClick={load}>Показать</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="space-y-2">
            <div className="inline-flex w-fit items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              Остаток: {formatCurrency(ordersMargin)}
            </div>
            <CardTitle className="text-lg">Все заказы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-semibold">Сумма заказов: {formatCurrency(ordersTotal)}</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Себестоимость: {formatCurrency(materialsCogs)}</div>
              <div>Остаток: {formatCurrency(ordersMargin)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Расходы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-semibold">{formatCurrency(expensesTotal)}</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Зарплаты: {formatCurrency(salaryTotal)}</div>
              <div>Выплаты: {formatCurrency(summary?.salary_payout_total ?? 0)}</div>
              <div>Премии: {formatCurrency(summary?.salary_bonus_total ?? 0)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Чистая прибыль</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatCurrency(summary?.net_profit ?? 0)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
