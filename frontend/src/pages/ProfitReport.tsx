import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/api/client";
import { toast } from "sonner";

type ProfitSummary = {
  month: string;
  sales_total: number;
  cogs_total: number;
  expenses_total: number;
  profit: number;
};

const formatAmount = (value?: number | null) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);

const currentMonth = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
};

export default function ProfitReport() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canLoad = useMemo(() => Boolean(month), [month]);

  const loadSummary = async () => {
    if (!month) return;
    setIsLoading(true);
    try {
      const data = await apiGet<ProfitSummary>(`/api/reports/profit?month=${month}`);
      setSummary(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить отчет по прибыли");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadSummary();
  }, [isAdmin, month]);

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
        <h1 className="text-3xl font-bold">Отчет по прибыли</h1>
        <p className="text-muted-foreground">Итог за выбранный месяц</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Label>Месяц</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Button variant="outline" onClick={loadSummary} disabled={!canLoad || isLoading}>
            Обновить
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Прибыль</div>
          <div className="text-2xl font-bold">{formatAmount(summary?.profit)} ₸</div>
          <div className="text-sm text-muted-foreground">
            Продажи - Себестоимость - Расходы
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Детализация</div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>Продажи: {formatAmount(summary?.sales_total)} ₸</div>
            <div>Себестоимость: {formatAmount(summary?.cogs_total)} ₸</div>
            <div>Расходы: {formatAmount(summary?.expenses_total)} ₸</div>
          </div>
        </Card>
      </div>

      {isLoading && <div className="text-muted-foreground">Загрузка...</div>}
    </div>
  );
}
