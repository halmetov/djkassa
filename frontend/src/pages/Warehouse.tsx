import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle } from "lucide-react";
import { apiGet } from "@/api/client";
import { toast } from "sonner";

type Branch = { id: number; name: string; active: boolean };
type StockItem = { id: number; product: string; quantity: number; limit?: number | null };
type LowStockItem = { id: number; name: string; branch: string; quantity: number; limit: number };

export default function Warehouse() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);

  useEffect(() => {
    fetchBranches();
    fetchLowStock();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchStock();
    }
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const data = await apiGet<Branch[]>("/api/branches");
      const active = data.filter((branch) => branch.active);
      setBranches(active);
      if (active.length > 0) {
        setSelectedBranch(String(active[0].id));
      }
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки филиалов");
    }
  };

  const fetchStock = async () => {
    setLoading(true);
    try {
      const data = await apiGet<StockItem[]>(`/api/branches/${selectedBranch}/stock`);
      setStock(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки склада");
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStock = async () => {
    try {
      const data = await apiGet<LowStockItem[]>("/api/products/low-stock");
      setLowStock(data);
    } catch (error) {
      console.error(error);
    }
  };

  const isLowStock = (item: StockItem) => {
    const limit = item.limit ?? 0;
    return item.quantity <= limit;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Склад</h1>
        <p className="text-muted-foreground">Остатки товаров</p>
      </div>

      <Card className="p-6">
        {lowStock.length > 0 && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Есть товары ниже лимита: {lowStock.length}. <button onClick={fetchLowStock} className="underline">Обновить</button>
          </div>
        )}
        <div className="mb-6">
          <Label>Филиал</Label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full md:w-64">
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

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="text-right">Количество</TableHead>
                <TableHead className="text-right">Лимит</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((item) => (
                <TableRow key={item.id} className={isLowStock(item) ? "bg-destructive/10" : ""}>
                  <TableCell className="font-medium">{item.product}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.limit ?? 0}</TableCell>
                  <TableCell>
                    {isLowStock(item) && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Мало на складе</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
