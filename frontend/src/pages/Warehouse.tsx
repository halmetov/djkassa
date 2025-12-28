import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { apiGet } from "@/api/client";
import { toast } from "sonner";

type Branch = { id: number; name: string; active: boolean };
type StockItem = { id: number; product: string; quantity: number; limit?: number | null; purchase_price?: number | null };
type LowStockItem = { id: number; name: string; branch: string; quantity: number; limit: number };

export default function Warehouse() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [purchaseTotal, setPurchaseTotal] = useState(0);

  useEffect(() => {
    fetchBranches();
    fetchLowStock();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchStock();
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchLowStock();
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
      const total = data.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.purchase_price || 0),
        0,
      );
      setPurchaseTotal(total);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки склада");
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStock = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranch) {
        params.set("branch_id", selectedBranch);
      }
      const data = await apiGet<LowStockItem[]>(`/api/products/low-stock${params.toString() ? `?${params.toString()}` : ""}`);
      setLowStock(data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Склад</h1>
        <p className="text-muted-foreground">Остатки товаров</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant={showLowOnly ? "outline" : "default"} onClick={() => setShowLowOnly(false)}>
              Все
            </Button>
            <Button
              variant={showLowOnly ? "default" : "outline"}
              onClick={() => {
                setShowLowOnly(true);
                fetchLowStock();
              }}
            >
              Мало осталось
            </Button>
          </div>
          {isAdmin && (
            <Card className="p-3 shadow-none border-dashed">
              <div className="text-sm text-muted-foreground">Сумма по цене прихода</div>
              <div className="text-xl font-semibold">{purchaseTotal.toFixed(2)} ₸</div>
            </Card>
          )}
        </div>
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
        ) : showLowOnly ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="text-right">Количество</TableHead>
                <TableHead className="text-right">Лимит</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStock.map((item) => (
                <TableRow key={`${item.id}-${item.branch}`}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.limit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="text-right">Количество</TableHead>
                <TableHead className="text-right">Лимит</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.limit ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
