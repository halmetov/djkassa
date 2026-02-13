import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Check, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type CounterpartyOption = {
  id: number;
  name?: string | null;
  company_name?: string | null;
  phone?: string | null;
};

type ProductOption = {
  id: number;
  name: string;
  barcode?: string | null;
  wholesale_price?: number | null;
};

type CounterpartySaleSummary = {
  id: number;
  created_at: string;
  counterparty_id?: number | null;
  counterparty_name?: string | null;
  counterparty_company_name?: string | null;
  counterparty_phone?: string | null;
  total_amount: number;
  created_by_name?: string | null;
};

type CounterpartySaleDetail = CounterpartySaleSummary & {
  branch_name?: string | null;
  items: {
    id: number;
    product_id: number;
    product_name?: string | null;
    quantity: number;
    price: number;
  }[];
};

type LineItem = {
  id: string;
  productId?: number;
  productName?: string;
  quantity: string;
  price: string;
  confirmed: boolean;
};

const formatAmount = (value?: number | null) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);

const createLineItem = (): LineItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  quantity: "1",
  price: "",
  confirmed: false,
});

export default function CounterpartySales() {
  const [counterpartyOpen, setCounterpartyOpen] = useState(false);
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [counterpartyOptions, setCounterpartyOptions] = useState<CounterpartyOption[]>([]);
  const [selectedCounterparty, setSelectedCounterparty] = useState<CounterpartyOption | null>(null);

  const [productOpenRow, setProductOpenRow] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [lineItems, setLineItems] = useState<LineItem[]>([createLineItem()]);
  const [isSaving, setIsSaving] = useState(false);

  const [history, setHistory] = useState<CounterpartySaleSummary[]>([]);
  const [selectedSale, setSelectedSale] = useState<CounterpartySaleDetail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const totalAmount = useMemo(
    () =>
      lineItems.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        return sum + qty * price;
      }, 0),
    [lineItems],
  );

  const loadCounterparties = useCallback(async (query: string) => {
    try {
      const data = await apiGet<CounterpartyOption[]>(
        `/api/counterparties?q=${encodeURIComponent(query)}&limit=20`,
      );
      setCounterpartyOptions(data);
    } catch (error) {
      console.error(error);
      const status = (error as any)?.status;
      if (status !== 403) {
        toast.error("Не удалось загрузить контрагентов");
      }
    }
  }, []);

  const loadProducts = useCallback(async (query: string) => {
    try {
      const data = await apiGet<ProductOption[]>(
        `/api/products?q=${encodeURIComponent(query)}&limit=20`,
      );
      setProductOptions(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить товары");
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await apiGet<CounterpartySaleSummary[]>("/api/counterparty-sales");
      setHistory(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить историю продаж");
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!counterpartyOpen) return;
    loadCounterparties(counterpartySearch);
  }, [counterpartyOpen, counterpartySearch, loadCounterparties]);

  useEffect(() => {
    if (!productOpenRow) return;
    loadProducts(productSearch);
  }, [productOpenRow, productSearch, loadProducts]);

  const handleAddRow = () => {
    setLineItems((prev) => [...prev, createLineItem()]);
  };

  const handleRemoveRow = (id: string) => {
    setLineItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length ? next : [createLineItem()];
    });
  };

  const handleUpdateRow = (id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const handleSelectProduct = (rowId: string, product: ProductOption) => {
    handleUpdateRow(rowId, {
      productId: product.id,
      productName: product.name,
      price: String(product.wholesale_price ?? 0),
      confirmed: false,
    });
    setProductOpenRow(null);
  };

  const handleSubmit = async () => {
    const prepared = lineItems
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => ({
        product_id: item.productId,
        quantity: Number(item.quantity),
        price: Number(item.price || 0),
      }));

    if (!prepared.length) {
      toast.error("Добавьте товары для продажи");
      return;
    }

    setIsSaving(true);
    try {
      await apiPost("/api/counterparty-sales", {
        counterparty_id: selectedCounterparty?.id ?? null,
        items: prepared,
      });
      toast.success("Продажа сохранена");
      setLineItems([createLineItem()]);
      setSelectedCounterparty(null);
      setCounterpartySearch("");
      loadHistory();
    } catch (error) {
      console.error(error);
      toast.error("Не удалось сохранить продажу");
    } finally {
      setIsSaving(false);
    }
  };

  const openDetails = async (saleId: number) => {
    try {
      const detail = await apiGet<CounterpartySaleDetail>(`/api/counterparty-sales/${saleId}`);
      setSelectedSale(detail);
      setDetailsOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить детали продажи");
    }
  };

  const resetForm = () => {
    setLineItems([createLineItem()]);
    setSelectedCounterparty(null);
    setCounterpartySearch("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Продажа (опт)</h1>
          <p className="text-muted-foreground">Оптовая продажа контрагентам</p>
        </div>
        <Button variant="outline" onClick={resetForm}>
          Создать +
        </Button>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Label>Контрагент</Label>
            <Popover open={counterpartyOpen} onOpenChange={setCounterpartyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between md:w-[320px]">
                  <span>
                    {selectedCounterparty
                      ? `${selectedCounterparty.name || "-"}${selectedCounterparty.company_name ? ` • ${selectedCounterparty.company_name}` : ""}`
                      : "Выберите контрагента"}
                  </span>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    value={counterpartySearch}
                    onValueChange={setCounterpartySearch}
                    placeholder="Поиск по имени, фирме или телефону"
                  />
                  <CommandList>
                    <CommandEmpty>Ничего не найдено</CommandEmpty>
                    <CommandGroup>
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
          <Button onClick={handleAddRow} variant="outline">
            Добавить товар
          </Button>
        </div>

        <div className="space-y-3">
          {lineItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-2 rounded-md border border-dashed border-muted-foreground/30 p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <Popover
                open={productOpenRow === item.id}
                onOpenChange={(open) => {
                  setProductOpenRow(open ? item.id : null);
                  if (!open) setProductSearch("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" disabled={item.confirmed}>
                    <span>{item.productName || "Товар"}</span>
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={productSearch}
                      onValueChange={setProductSearch}
                      placeholder="Поиск по названию или штрихкоду"
                    />
                    <CommandList>
                      <CommandEmpty>Ничего не найдено</CommandEmpty>
                      <CommandGroup>
                        {productOptions.map((option) => (
                          <CommandItem
                            key={option.id}
                            onSelect={() => handleSelectProduct(item.id, option)}
                          >
                            <div className="flex flex-col">
                              <span>{option.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {option.barcode ? `Штрихкод: ${option.barcode}` : "Без штрихкода"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Input
                type="number"
                min="0"
                placeholder="Кол-во"
                value={item.quantity}
                onChange={(e) => handleUpdateRow(item.id, { quantity: e.target.value })}
                disabled={item.confirmed}
              />

              <Input
                type="number"
                min="0"
                placeholder="Цена"
                value={item.price}
                onChange={(e) => handleUpdateRow(item.id, { price: e.target.value })}
                disabled={item.confirmed}
              />

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant={item.confirmed ? "default" : "outline"}
                  onClick={() => handleUpdateRow(item.id, { confirmed: !item.confirmed })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleRemoveRow(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-lg font-semibold">
            Итого: {formatAmount(totalAmount)} ₸
          </div>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Сохранение..." : "Отправить / Сохранить"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">История</h2>
          <p className="text-sm text-muted-foreground">Последние оптовые продажи</p>
        </div>
        <div className="space-y-3">
          {history.map((sale) => (
            <div
              key={sale.id}
              className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="font-medium">
                  {sale.counterparty_name || "Без контрагента"}
                  {sale.counterparty_company_name ? ` • ${sale.counterparty_company_name}` : ""}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(sale.created_at).toLocaleString("ru-RU")}
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 md:flex-row md:items-center">
                <div className="text-lg font-semibold">{formatAmount(sale.total_amount)} ₸</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => openDetails(sale.id)}>
                    Подробнее
                  </Button>
                  <Button variant="secondary" onClick={() => window.open(`/counterparty-sales/${sale.id}/print`, "_blank")}>
                    Печать
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!history.length && (
            <div className="text-sm text-muted-foreground">Пока нет оптовых продаж.</div>
          )}
        </div>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали продажи</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Дата: {new Date(selectedSale.created_at).toLocaleString("ru-RU")}</div>
                <div>Контрагент: {selectedSale.counterparty_name || "-"}</div>
                <div>Филиал: {selectedSale.branch_name || "-"}</div>
                <div>Создал: {selectedSale.created_by_name || "-"}</div>
              </div>
              <div className="space-y-2">
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{item.product_name || "Товар"}</div>
                      <div className="text-muted-foreground">
                        {item.quantity} × {formatAmount(item.price)} ₸
                      </div>
                    </div>
                    <div className="font-semibold">
                      {formatAmount(item.quantity * item.price)} ₸
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right text-lg font-semibold">
                Итого: {formatAmount(selectedSale.total_amount)} ₸
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
