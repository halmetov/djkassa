import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export type IncomeBranch = { id: number; name: string; active?: boolean };
export type IncomeProduct = { id: number; name: string; barcode?: string | null; purchase_price?: number; sale_price?: number };
export type IncomeItem = { id: number; product_id: number; quantity: number; purchase_price: number; sale_price: number };
export type IncomeRecord = { id: number; branch_id: number; created_at: string; items: IncomeItem[] };
export type IncomeSubmitItem = { product_id: number; quantity: number; purchase_price: number; sale_price: number };

interface IncomePageBaseProps {
  title: string;
  description: string;
  branchSelector: "selectable" | "fixed";
  fetchBranches: () => Promise<IncomeBranch[]>;
  fetchProducts: () => Promise<IncomeProduct[]>;
  fetchIncomes: (branchId?: number) => Promise<IncomeRecord[]>;
  submitIncome: (payload: { branch_id: number; items: IncomeSubmitItem[] }) => Promise<void>;
  deleteIncome?: (incomeId: number) => Promise<void>;
  canDelete?: boolean;
  fixedBranchId?: number;
  fixedBranchName?: string;
}

export function IncomePageBase({
  title,
  description,
  branchSelector,
  fetchBranches,
  fetchProducts,
  fetchIncomes,
  submitIncome,
  deleteIncome,
  canDelete = false,
  fixedBranchId,
  fixedBranchName,
}: IncomePageBaseProps) {
  const isMobile = useIsMobile();
  const [branches, setBranches] = useState<IncomeBranch[]>([]);
  const [products, setProducts] = useState<IncomeProduct[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [formData, setFormData] = useState({
    branch_id: "",
    product_id: "",
    quantity: "",
    purchase_price: "",
    sale_price: "",
  });
  const [invoiceData, setInvoiceData] = useState({
    branch_id: "",
    items: [
      {
        product_id: "",
        quantity: "",
        purchase_price: "",
        sale_price: "",
      },
    ],
  });

  const effectiveBranchId = useMemo(() => {
    if (branchSelector === "fixed" && fixedBranchId) return String(fixedBranchId);
    return formData.branch_id;
  }, [branchSelector, fixedBranchId, formData.branch_id]);

  const loadIncomes = async () => {
    try {
      const branchId = branchSelector === "fixed" ? fixedBranchId ?? branches[0]?.id : undefined;
      const data = await fetchIncomes(branchId);
      setIncomes(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки истории");
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const branchList = await fetchBranches();
        const filtered = branchSelector === "selectable" ? branchList.filter((b) => b.active !== false) : branchList;
        setBranches(filtered);
        if (branchSelector === "fixed") {
          const targetId = fixedBranchId ?? filtered[0]?.id;
          if (targetId) {
            setFormData((prev) => ({ ...prev, branch_id: String(targetId) }));
            setInvoiceData((prev) => ({ ...prev, branch_id: String(targetId) }));
          }
        }
        if (filtered.length > 0 && branchSelector === "selectable") {
          setFormData((prev) => ({ ...prev, branch_id: String(filtered[0].id) }));
          setInvoiceData((prev) => ({ ...prev, branch_id: String(filtered[0].id) }));
        }
      } catch (error) {
        console.error(error);
        toast.error("Ошибка загрузки филиалов");
      }
    };
    load();
  }, [branchSelector, fetchBranches, fixedBranchId]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await fetchProducts();
        setProducts(data);
      } catch (error) {
        console.error(error);
        toast.error("Ошибка загрузки товаров");
      }
    };
    loadProducts();
  }, [fetchProducts]);

  useEffect(() => {
    loadIncomes();
  }, [branchSelector, fetchIncomes, fixedBranchId, branches]);

  const handleSingleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === Number(productId));
    setFormData({
      ...formData,
      product_id: productId,
      purchase_price: product ? String(product.purchase_price ?? "") : "",
      sale_price: product ? String(product.sale_price ?? "") : "",
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBranchId || !formData.product_id || !formData.quantity || !formData.purchase_price || !formData.sale_price) {
      toast.error("Заполните все поля");
      return;
    }
    try {
      await submitIncome({
        branch_id: Number(effectiveBranchId),
        items: [
          {
            product_id: Number(formData.product_id),
            quantity: Number(formData.quantity),
            purchase_price: Number(formData.purchase_price),
            sale_price: Number(formData.sale_price),
          },
        ],
      });
      toast.success("Приход успешно добавлен");
      setFormData({ branch_id: branchSelector === "fixed" ? effectiveBranchId : "", product_id: "", quantity: "", purchase_price: "", sale_price: "" });
      loadIncomes();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при добавлении прихода");
    }
  };

  const handleInvoiceProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === Number(productId));
    setInvoiceData((prev) => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        product_id: productId,
        purchase_price: product ? String(product.purchase_price ?? "") : "",
        sale_price: product ? String(product.sale_price ?? "") : "",
      };
      return { ...prev, items };
    });
  };

  const updateInvoiceItem = (index: number, field: keyof (typeof invoiceData)["items"][number], value: string) => {
    setInvoiceData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addInvoiceItem = () => {
    setInvoiceData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { product_id: "", quantity: "", purchase_price: "", sale_price: "" },
      ],
    }));
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceData((prev) => {
      if (prev.items.length === 1) return prev;
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items };
    });
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchId = branchSelector === "fixed" ? fixedBranchId : Number(invoiceData.branch_id);
    if (!branchId) {
      toast.error("Выберите филиал");
      return;
    }

    const preparedItems = invoiceData.items.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
      purchase_price: Number(item.purchase_price),
      sale_price: Number(item.sale_price),
    }));

    if (
      preparedItems.length === 0 ||
      preparedItems.some(
        (item) => !item.product_id || !item.quantity || Number.isNaN(item.purchase_price) || Number.isNaN(item.sale_price),
      )
    ) {
      toast.error("Заполните все строки накладной");
      return;
    }

    try {
      await submitIncome({
        branch_id: Number(branchId),
        items: preparedItems,
      });
      toast.success("Приход по накладной сохранен");
      setInvoiceData({
        branch_id: branchSelector === "fixed" && fixedBranchId ? String(fixedBranchId) : "",
        items: [{ product_id: "", quantity: "", purchase_price: "", sale_price: "" }],
      });
      loadIncomes();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при сохранении накладной");
    }
  };

  const getProductName = (id: number) => products.find((product) => product.id === id)?.name || `#${id}`;
  const getBranchName = (id: number) => branches.find((branch) => branch.id === id)?.name || fixedBranchName || `Филиал ${id}`;

  const handleDeleteIncome = async (incomeId: number) => {
    if (!deleteIncome) return;
    const confirmed = window.confirm("Удалить приход? Остатки будут уменьшены.");
    if (!confirmed) return;
    try {
      await deleteIncome(incomeId);
      toast.success("Приход удален");
      loadIncomes();
    } catch (error) {
      console.error(error);
      toast.error("Не удалось удалить приход");
    }
  };

  const ProductCombobox = ({
    value,
    onChange,
    placeholder = "Выберите товар",
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const selected = products.find((product) => String(product.id) === value);
    const normalized = search.trim().toLowerCase();
    const filtered = normalized
      ? products.filter((product) => {
          const nameMatch = product.name.toLowerCase().includes(normalized);
          const barcodeMatch = product.barcode ? product.barcode.toLowerCase().includes(normalized) : false;
          return nameMatch || barcodeMatch;
        })
      : products;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between"
            onClick={() => {
              setOpen((prev) => !prev);
              setSearch("");
            }}
          >
            {selected ? selected.name : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[360px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск по названию или штрихкоду"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Ничего не найдено</CommandEmpty>
              <CommandGroup>
                {filtered.map((product) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => {
                      onChange(String(product.id));
                      setSearch(product.name);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1"
                  >
                    <div className="font-semibold">{product.name}</div>
                    {product.barcode && (
                      <div className="text-xs text-muted-foreground">{product.barcode}</div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Tabs defaultValue="receipt" className="w-full">
        <TabsList>
          <TabsTrigger value="receipt">Обычный приход</TabsTrigger>
          <TabsTrigger value="invoice">Приход по накладным</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        <TabsContent value="receipt" className="space-y-4">
          <form
            onSubmit={handleAdd}
            className="grid gap-4 p-4 border rounded-lg bg-card md:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="branch">Филиал</Label>
              {branchSelector === "fixed" ? (
                <div className="p-2 border rounded bg-muted/50">{fixedBranchName}</div>
              ) : (
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите филиал" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product">Товар</Label>
              <ProductCombobox value={formData.product_id} onChange={handleSingleProductChange} />
            </div>
            <div className="space-y-2">
              <Label>Количество</Label>
              <Input
                type="number"
                value={formData.quantity}
                inputMode="decimal"
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Цена закупки</Label>
              <Input
                type="number"
                value={formData.purchase_price}
                inputMode="decimal"
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Цена продажи</Label>
              <Input
                type="number"
                value={formData.sale_price}
                inputMode="decimal"
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" size={isMobile ? "lg" : "default"}>
                Добавить приход
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="invoice" className="space-y-4">
          <form onSubmit={handleInvoiceSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
            <div className="max-w-sm space-y-2">
              <Label>Филиал</Label>
              {branchSelector === "fixed" ? (
                <div className="p-2 border rounded bg-muted/50">{fixedBranchName}</div>
              ) : (
                <Select
                  value={invoiceData.branch_id}
                  onValueChange={(value) => setInvoiceData((prev) => ({ ...prev, branch_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите филиал" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {isMobile ? (
              <div className="space-y-3">
                {invoiceData.items.map((item, index) => {
                  const productName = products.find((p) => p.id === Number(item.product_id))?.name;
                  return (
                    <Card key={index} className="p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-2 flex-1">
                          <Label className="text-xs text-muted-foreground">Товар</Label>
                          <ProductCombobox
                            value={item.product_id}
                            onChange={(value) => handleInvoiceProductChange(index, value)}
                          />
                          {productName && (
                            <p className="text-xs text-muted-foreground truncate">{productName}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInvoiceItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateInvoiceItem(index, "quantity", e.target.value)}
                          placeholder="Количество"
                        />
                        <Input
                          type="number"
                          value={item.purchase_price}
                          onChange={(e) => updateInvoiceItem(index, "purchase_price", e.target.value)}
                          placeholder="Цена закупки"
                        />
                        <Input
                          type="number"
                          value={item.sale_price}
                          onChange={(e) => updateInvoiceItem(index, "sale_price", e.target.value)}
                          placeholder="Цена продажи"
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Товар</TableHead>
                      <TableHead className="min-w-[120px]">Количество</TableHead>
                      <TableHead className="min-w-[160px]">Цена закупки</TableHead>
                      <TableHead className="min-w-[160px]">Цена продажи</TableHead>
                      <TableHead className="min-w-[140px]">Иого</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <ProductCombobox
                            value={item.product_id}
                            onChange={(value) => handleInvoiceProductChange(index, value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateInvoiceItem(index, "quantity", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.purchase_price}
                            onChange={(e) => updateInvoiceItem(index, "purchase_price", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.sale_price}
                            onChange={(e) => updateInvoiceItem(index, "sale_price", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          {((Number(item.purchase_price) || 0) * (Number(item.quantity) || 0)).toFixed(2)} ₸
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeInvoiceItem(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div
              className="flex flex-wrap gap-2 sticky bottom-0 bg-card/80 backdrop-blur p-3 border-t"
              style={{ paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 10px)" : undefined }}
            >
              <Button type="button" variant="outline" onClick={addInvoiceItem} className="flex-1 min-w-[140px]">
                + Добавить строку
              </Button>
              <Button type="submit" className="flex-1 min-w-[160px]" size={isMobile ? "lg" : "default"}>
                Сохранить приход
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Филиал</TableHead>
                    <TableHead>Товары</TableHead>
                    {canDelete && <TableHead className="w-[120px]">Действия</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomes.map((income) => (
                    <TableRow key={income.id}>
                      <TableCell>{new Date(income.created_at).toLocaleString("ru-RU")}</TableCell>
                      <TableCell>{getBranchName(income.branch_id)}</TableCell>
                      <TableCell>
                        <ul className="text-sm space-y-1">
                          {income.items.map((item) => (
                            <li key={item.id}>
                              {getProductName(item.product_id)} — {item.quantity} шт. по {item.purchase_price} ₸ / {item.sale_price} ₸
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      {canDelete && (
                        <TableCell>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteIncome(income.id)}>
                            Удалить
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
