import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/api/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search } from "lucide-react";

type ProfitSummary = {
  month: string;
  sales_total: number;
  cogs_total: number;
  expenses_total: number;
  profit: number;
};

type CounterpartyProfitSummary = {
  count_sales: number;
  revenue: number;
  cost: number;
  profit: number;
};

type CounterpartyOption = {
  id: number;
  name?: string | null;
  company_name?: string | null;
  phone?: string | null;
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
  const [counterpartyMonth, setCounterpartyMonth] = useState(currentMonth());
  const [counterpartySummary, setCounterpartySummary] = useState<CounterpartyProfitSummary | null>(null);
  const [isCounterpartyLoading, setIsCounterpartyLoading] = useState(false);
  const [counterpartyOpen, setCounterpartyOpen] = useState(false);
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [counterpartyOptions, setCounterpartyOptions] = useState<CounterpartyOption[]>([]);
  const [selectedCounterparty, setSelectedCounterparty] = useState<CounterpartyOption | null>(null);

  const canLoad = useMemo(() => Boolean(month), [month]);
  const canLoadCounterparties = useMemo(() => Boolean(counterpartyMonth), [counterpartyMonth]);

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

  const loadCounterpartySummary = async () => {
    if (!counterpartyMonth) return;
    setIsCounterpartyLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("month", counterpartyMonth);
      if (selectedCounterparty?.id) {
        params.set("counterparty_id", String(selectedCounterparty.id));
      }
      const data = await apiGet<CounterpartyProfitSummary>(
        `/api/reports/profit/counterparties?${params.toString()}`,
      );
      setCounterpartySummary(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить отчет по контрагентам");
    } finally {
      setIsCounterpartyLoading(false);
    }
  };

  const loadCounterparties = useCallback(async (query: string) => {
    try {
      const data = await apiGet<CounterpartyOption[]>(
        `/api/counterparties?q=${encodeURIComponent(query)}&limit=20`,
      );
      setCounterpartyOptions(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить контрагентов");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadSummary();
  }, [isAdmin, month]);

  useEffect(() => {
    if (!isAdmin) return;
    loadCounterpartySummary();
  }, [isAdmin, counterpartyMonth, selectedCounterparty?.id]);

  useEffect(() => {
    if (!counterpartyOpen) return;
    loadCounterparties(counterpartySearch);
  }, [counterpartyOpen, counterpartySearch, loadCounterparties]);

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

      <div className="pt-4">
        <h2 className="text-2xl font-semibold">Контрагенты</h2>
        <p className="text-muted-foreground">Прибыль по оптовым продажам</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Label>Месяц</Label>
            <Input
              type="month"
              value={counterpartyMonth}
              onChange={(e) => setCounterpartyMonth(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Контрагент</Label>
            <Popover open={counterpartyOpen} onOpenChange={setCounterpartyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between md:w-[280px]">
                  <span>
                    {selectedCounterparty
                      ? `${selectedCounterparty.name || "-"}${selectedCounterparty.company_name ? ` • ${selectedCounterparty.company_name}` : ""}`
                      : "Все контрагенты"}
                  </span>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    value={counterpartySearch}
                    onValueChange={setCounterpartySearch}
                    placeholder="Поиск по имени или фирме"
                  />
                  <CommandList>
                    <CommandEmpty>Ничего не найдено</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setSelectedCounterparty(null);
                          setCounterpartyOpen(false);
                        }}
                      >
                        Все контрагенты
                      </CommandItem>
                      {counterpartyOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          onSelect={() => {
                            setSelectedCounterparty(option);
                            setCounterpartyOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{option.name || "-"}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.company_name || "Без фирмы"}{option.phone ? ` • ${option.phone}` : ""}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            variant="outline"
            onClick={loadCounterpartySummary}
            disabled={!canLoadCounterparties || isCounterpartyLoading}
          >
            Обновить
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Сколько продаж</div>
          <div className="text-2xl font-bold">{counterpartySummary?.count_sales ?? 0}</div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Прибыль</div>
          <div className="text-2xl font-bold">{formatAmount(counterpartySummary?.profit)} ₸</div>
          <div className="text-sm text-muted-foreground">
            Выручка {formatAmount(counterpartySummary?.revenue)} ₸ • Себестоимость{" "}
            {formatAmount(counterpartySummary?.cost)} ₸
          </div>
        </Card>
      </div>

      {isCounterpartyLoading && <div className="text-muted-foreground">Загрузка...</div>}
    </div>
  );
}
