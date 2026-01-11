import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export type BranchOption = { id: string; name: string };
export type StockRow = {
  id: string | number;
  name: string;
  quantity: number;
  limit?: number | null;
  purchase_price?: number | null;
};
export type LowStockRow = { id: string | number; name: string; branch?: string; quantity: number; limit: number | null };

interface StockPageBaseProps {
  title: string;
  description: string;
  branchSelector: "selectable" | "fixed";
  fetchBranches: () => Promise<BranchOption[]>;
  fetchStock: (branchId: string) => Promise<StockRow[]>;
  fetchLowStock: (branchId: string | null) => Promise<LowStockRow[]>;
  fixedBranchId?: string;
  fixedBranchName?: string;
  showPurchaseTotal?: boolean;
}

export function StockPageBase({
  title,
  description,
  branchSelector,
  fetchBranches,
  fetchStock,
  fetchLowStock,
  fixedBranchId,
  fixedBranchName,
  showPurchaseTotal = false,
}: StockPageBaseProps) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  const [showLowOnly, setShowLowOnly] = useState(false);

  const purchaseTotal = useMemo(
    () => stock.reduce((sum, item) => sum + (item.quantity || 0) * (item.purchase_price || 0), 0),
    [stock],
  );

  useEffect(() => {
    const init = async () => {
      try {
        const data = await fetchBranches();
        setBranches(data);
        if (branchSelector === "fixed" && fixedBranchId) {
          setSelectedBranch(fixedBranchId);
        } else if (data.length > 0) {
          setSelectedBranch(String(data[0].id));
        }
      } catch (error) {
        console.error(error);
        toast.error("Ошибка загрузки филиалов");
      }
    };
    init();
  }, [branchSelector, fetchBranches, fixedBranchId]);

  useEffect(() => {
    if (!selectedBranch) return;
    const loadStock = async () => {
      setLoading(true);
      try {
        const data = await fetchStock(selectedBranch);
        setStock(data);
      } catch (error) {
        console.error(error);
        toast.error("Ошибка загрузки склада");
      } finally {
        setLoading(false);
      }
    };
    loadStock();
  }, [fetchStock, selectedBranch]);

  useEffect(() => {
    const loadLowStock = async () => {
      try {
        const data = await fetchLowStock(selectedBranch || null);
        setLowStock(data);
      } catch (error) {
        console.error(error);
      }
    };
    loadLowStock();
  }, [fetchLowStock, selectedBranch]);

  const renderBranchSelector = () => {
    if (branchSelector === "fixed") {
      return (
        <div className="space-y-1">
          <Label>Филиал</Label>
          <div className="p-2 border rounded bg-muted/50 text-sm">{fixedBranchName}</div>
        </div>
      );
    }

    return (
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
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
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
              }}
            >
              Мало осталось
            </Button>
          </div>
          {showPurchaseTotal && (
            <Card className="p-3 shadow-none border-dashed">
              <div className="text-sm text-muted-foreground">Сумма по цене прихода</div>
              <div className="text-xl font-semibold">{purchaseTotal.toFixed(2)} ₸</div>
            </Card>
          )}
        </div>

        {renderBranchSelector()}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : showLowOnly ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="text-right">Количество</TableHead>
                <TableHead className="text-right">Лимит</TableHead>
                {branchSelector === "selectable" && <TableHead>Филиал</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStock.map((item) => (
                <TableRow key={`${item.id}-${item.branch}`}> 
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.limit}</TableCell>
                  {branchSelector === "selectable" && <TableCell>{item.branch}</TableCell>}
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
                  <TableCell className="font-medium">{item.name}</TableCell>
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
