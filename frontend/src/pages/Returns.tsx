import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { apiGet, apiPost } from "@/api/client";

type SaleDetailItem = {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  discount?: number;
  total: number;
  product_name?: string | null;
  product_unit?: string | null;
};

type SaleDetail = {
  id: number;
  created_at: string;
  branch_name?: string | null;
  seller_name?: string | null;
  total_amount: number;
  paid_debt: number;
  client_name?: string | null;
  client_id?: number | null;
  items: SaleDetailItem[];
};

export default function Returns() {
  const [searchSaleId, setSearchSaleId] = useState("");
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [returnItems, setReturnItems] = useState<Map<number, number>>(new Map());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const searchSale = async () => {
    if (!searchSaleId.trim()) {
      toast.error("Введите ID чека");
      return;
    }
    try {
      const saleData = await apiGet<SaleDetail>(`/api/sales/${searchSaleId.trim()}`);
      setSale(saleData);
      setReturnItems(new Map());
    } catch (error) {
      console.error(error);
      toast.error("Чек не найден");
    }
  };

  const updateReturnQuantity = (itemId: number, maxQty: number, value: number) => {
    const newMap = new Map(returnItems);
    const qty = Math.min(Math.max(0, value), maxQty);
    if (qty > 0) {
      newMap.set(itemId, qty);
    } else {
      newMap.delete(itemId);
    }
    setReturnItems(newMap);
  };

  const getTotalReturnAmount = () => {
    if (!sale) return 0;
    return sale.items.reduce((sum, item) => {
      const returnQty = returnItems.get(item.id) || 0;
      const unitTotal = item.total || item.price * item.quantity;
      const unitPrice = unitTotal / item.quantity;
      return sum + returnQty * unitPrice;
    }, 0);
  };

  const handleReturn = async () => {
    if (!sale) return;
    if (returnItems.size === 0) {
      toast.error("Выберите товары для возврата");
      return;
    }
    try {
      for (const [itemId, returnQty] of returnItems.entries()) {
        const item = sale.items.find((i) => i.id === itemId);
        if (!item) continue;
        await apiPost("/api/returns", {
          sale_id: sale.id,
          type: "by_item",
          items: [
            {
              sale_item_id: item.id,
              quantity: returnQty,
            },
          ],
        });
      }
      toast.success("Возврат выполнен успешно");
      setSale(null);
      setReturnItems(new Map());
      setSearchSaleId("");
      setShowConfirmModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при возврате");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Возврат</h1>
        <p className="text-muted-foreground">Возврат товаров</p>
      </div>

      <Card className="p-6">
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="ID чека"
            value={searchSaleId}
            onChange={(e) => setSearchSaleId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchSale()}
          />
          <Button onClick={searchSale}>
            <Search className="h-4 w-4 mr-2" />
            Найти
          </Button>
        </div>

        {sale && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Дата:</span> {new Date(sale.created_at).toLocaleString('ru-RU')}
              </div>
              <div>
                <span className="text-muted-foreground">Сотрудник:</span> {sale.seller_name || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Филиал:</span> {sale.branch_name || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Сумма:</span>
                <span className="font-bold"> {sale.total_amount.toFixed(2)} ₸</span>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="text-right">Продано</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead className="text-right">Вернуть</TableHead>
                  <TableHead className="text-right">Сумма возврата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item) => {
                  const returnQty = returnItems.get(item.id) || 0;
                  const unitTotal = item.total || item.price * item.quantity;
                  const unitPrice = unitTotal / item.quantity;
                  const returnAmount = returnQty * unitPrice;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name || `ID ${item.product_id}`}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.product_unit || "шт"}
                      </TableCell>
                      <TableCell className="text-right">{item.price.toFixed(2)} ₸</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={returnQty}
                          onChange={(e) => updateReturnQuantity(item.id, item.quantity, parseInt(e.target.value) || 0)}
                          className="w-24 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">{returnAmount.toFixed(2)} ₸</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center border-t pt-4">
              <div className="text-xl font-bold">Итого к возврату: {getTotalReturnAmount().toFixed(2)} ₸</div>
              <Button onClick={() => setShowConfirmModal(true)} disabled={returnItems.size === 0}>
                Выполнить возврат
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение возврата</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p>Вы уверены, что хотите выполнить возврат на сумму {getTotalReturnAmount().toFixed(2)} ₸?</p>
            <ul className="text-sm space-y-1">
              {sale &&
                Array.from(returnItems.entries()).map(([itemId, qty]) => {
                  const item = sale.items.find((i) => i.id === itemId);
                  return (
                    <li key={itemId}>
                      • {item?.product_name || `ID ${item?.product_id}`}: {qty} {item?.product_unit || "шт"}
                    </li>
                  );
                })}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Отмена
            </Button>
            <Button onClick={handleReturn}>Подтвердить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
