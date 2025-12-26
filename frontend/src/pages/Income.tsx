import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { apiGet, apiPost } from "@/api/client";

type Branch = { id: number; name: string; active?: boolean };
type Product = { id: number; name: string; purchase_price: number; sale_price: number };
type IncomeItem = { id: number; product_id: number; quantity: number; purchase_price: number; sale_price: number };
type IncomeRecord = { id: number; branch_id: number; created_at: string; items: IncomeItem[] };
type InvoiceItemForm = { product_id: string; quantity: string; purchase_price: string; sale_price: string };

export default function Income() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
      } as InvoiceItemForm,
    ],
  });

  useEffect(() => {
    fetchBranches();
    fetchProducts();
    fetchIncomes();
  }, []);

  const fetchBranches = async () => {
    try {
      const data = await apiGet<Branch[]>("/api/branches");
      setBranches(data.filter((branch) => branch.active));
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки филиалов");
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiGet<Product[]>("/api/products");
      setProducts(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки товаров");
    }
  };

  const fetchIncomes = async () => {
    try {
      const data = await apiGet<IncomeRecord[]>("/api/income");
      setIncomes(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки истории");
    }
  };

  const handleSingleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === Number(productId));
    setFormData({
      ...formData,
      product_id: productId,
      purchase_price: product ? String(product.purchase_price) : "",
      sale_price: product ? String(product.sale_price) : "",
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branch_id || !formData.product_id || !formData.quantity || !formData.purchase_price || !formData.sale_price) {
      toast.error("Заполните все поля");
      return;
    }
    try {
      await apiPost("/api/income", {
        branch_id: Number(formData.branch_id),
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
      setFormData({ branch_id: "", product_id: "", quantity: "", purchase_price: "", sale_price: "" });
      fetchIncomes();
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
        purchase_price: product ? String(product.purchase_price) : "",
        sale_price: product ? String(product.sale_price) : "",
      };
      return { ...prev, items };
    });
  };

  const updateInvoiceItem = (index: number, field: keyof InvoiceItemForm, value: string) => {
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
    if (!invoiceData.branch_id) {
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
      await apiPost("/api/income", {
        branch_id: Number(invoiceData.branch_id),
        items: preparedItems,
      });
      toast.success("Приход по накладной сохранен");
      setInvoiceData({
        branch_id: "",
        items: [{ product_id: "", quantity: "", purchase_price: "", sale_price: "" }],
      });
      fetchIncomes();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при сохранении накладной");
    }
  };

  const getProductName = (id: number) => products.find((product) => product.id === id)?.name || `#${id}`;
  const getBranchName = (id: number) => branches.find((branch) => branch.id === id)?.name || `Филиал ${id}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Приход</h1>
        <p className="text-muted-foreground">Приход товаров на склад</p>
      </div>

      <Tabs defaultValue="receipt" className="w-full">
        <TabsList>
          <TabsTrigger value="receipt">Обычный приход</TabsTrigger>
          <TabsTrigger value="invoice">Приход по накладным</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        <TabsContent value="receipt" className="space-y-4">
          <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4 border rounded-lg bg-card">
            <div className="space-y-2">
              <Label htmlFor="branch">Филиал</Label>
              <Select value={formData.branch_id} onValueChange={(value) => setFormData({ ...formData, branch_id: value })}>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="product">Товар</Label>
              <Select value={formData.product_id} onValueChange={handleSingleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите товар" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Количество</Label>
              <Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Цена закупки</Label>
              <Input type="number" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Цена продажи</Label>
              <Input type="number" value={formData.sale_price} onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Добавить приход
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="invoice" className="space-y-4">
          <form onSubmit={handleInvoiceSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
            <div className="max-w-sm space-y-2">
              <Label>Филиал</Label>
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
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Товар</TableHead>
                    <TableHead className="min-w-[120px]">Количество</TableHead>
                    <TableHead className="min-w-[160px]">Цена закупки</TableHead>
                    <TableHead className="min-w-[160px]">Цена продажи</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select value={item.product_id} onValueChange={(value) => handleInvoiceProductChange(index, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите товар" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={String(product.id)}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeInvoiceItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addInvoiceItem}>
                + Добавить строку
              </Button>
              <Button type="submit">Сохранить приход</Button>
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
