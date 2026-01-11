import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";

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

type Client = {
  id: number;
  name: string;
  total_debt: number;
};

type ReturnSummary = {
  id: number;
  sale_id: number;
  branch_name?: string | null;
  created_by_name?: string | null;
  client_name?: string | null;
  type: string;
  total_amount: number;
  created_at: string;
};

type ReturnDetail = ReturnSummary & {
  items: {
    id: number;
    sale_item_id: number;
    quantity: number;
    amount: number;
    product_name?: string | null;
  }[];
  reason?: string | null;
};

export default function Returns() {
  const [searchSaleId, setSearchSaleId] = useState("");
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [returnItems, setReturnItems] = useState<Map<number, number>>(new Map());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [history, setHistory] = useState<ReturnSummary[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<ReturnDetail | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [outstandingDebt, setOutstandingDebt] = useState<number | null>(null);
  const [debtOffsetAmount, setDebtOffsetAmount] = useState("");

  const searchSale = async () => {
    if (!searchSaleId.trim()) {
      toast.error("Введите ID чека");
      return;
    }
    try {
      const saleData = await apiGet<SaleDetail>(`/api/sales/${searchSaleId.trim()}`);
      setSale(saleData);
      setReturnItems(new Map());
      setOutstandingDebt(null);
      setDebtOffsetAmount("");
    } catch (error) {
      console.error(error);
      toast.error("Чек не найден");
    }
  };

  const loadHistory = async () => {
    try {
      const list = await apiGet<ReturnSummary[]>("/api/returns");
      setHistory(list);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить историю возвратов");
    }
  };

  const loadReturnDetail = async (id: number) => {
    try {
      const detail = await apiGet<ReturnDetail>(`/api/returns/${id}`);
      setSelectedReturn(detail);
      setShowReturnModal(true);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить детали возврата");
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

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

  const handleReturn = async (options?: { applyToDebt?: boolean; offsetAmount?: number }) => {
    if (!sale) return;
    if (returnItems.size === 0) {
      toast.error("Выберите товары для возврата");
      return;
    }
    try {
      const items = Array.from(returnItems.entries()).map(([itemId, returnQty]) => ({
        sale_item_id: itemId,
        quantity: returnQty,
      }));
      await apiPost("/api/returns", {
        sale_id: sale.id,
        type: "by_item",
        items,
        apply_to_debt: options?.applyToDebt ?? false,
        debt_offset_amount: options?.offsetAmount ?? null,
      });
      toast.success("Возврат выполнен успешно");
      setSale(null);
      setReturnItems(new Map());
      setSearchSaleId("");
      setShowConfirmModal(false);
      setShowDebtModal(false);
      setOutstandingDebt(null);
      setDebtOffsetAmount("");
      loadHistory();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при возврате");
    }
  };

  const handleReturnRequest = async () => {
    if (!sale) return;
    if (returnItems.size === 0) {
      toast.error("Выберите товары для возврата");
      return;
    }
    const totalReturn = getTotalReturnAmount();
    if (sale.client_id) {
      try {
        const client = await apiGet<Client>(`/api/clients/${sale.client_id}`);
        setOutstandingDebt(client.total_debt);
        if (client.total_debt > 0) {
          const maxOffset = Math.min(totalReturn, client.total_debt);
          setDebtOffsetAmount(maxOffset.toFixed(2));
          setShowDebtModal(true);
          return;
        }
      } catch (error) {
        console.error(error);
        toast.error("Не удалось получить долг клиента");
      }
    }
    setShowConfirmModal(true);
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
              <Button onClick={handleReturnRequest} disabled={returnItems.size === 0}>
                Выполнить возврат
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">История возвратов</h3>
            <p className="text-sm text-muted-foreground">Последние операции</p>
          </div>
          <Button variant="outline" onClick={loadHistory}>
            Обновить
          </Button>
        </div>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground">Пока нет возвратов</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Чек</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.created_at).toLocaleString("ru-RU")}</TableCell>
                  <TableCell>#{entry.sale_id}</TableCell>
                  <TableCell>{entry.client_name || "-"}</TableCell>
                  <TableCell>{entry.created_by_name || "-"}</TableCell>
                  <TableCell className="font-medium text-destructive">- {entry.total_amount.toFixed(2)} ₸</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => loadReturnDetail(entry.id)}>
                      Подробнее
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <Dialog open={showDebtModal} onOpenChange={setShowDebtModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Погашение долга при возврате</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p>У клиента есть долг. Зачесть возврат в погашение долга?</p>
            <div className="text-muted-foreground">
              Долг клиента: {outstandingDebt?.toFixed(2)} ₸
            </div>
            <div>
              <Label>Сумма зачета</Label>
              <Input
                type="number"
                min="0"
                value={debtOffsetAmount}
                onChange={(e) => setDebtOffsetAmount(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                Максимум: {Math.min(getTotalReturnAmount(), outstandingDebt || 0).toFixed(2)} ₸
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleReturn({ applyToDebt: false })}>
              Не зачитывать
            </Button>
            <Button
              onClick={() => {
                const maxOffset = Math.min(getTotalReturnAmount(), outstandingDebt || 0);
                const parsed = parseFloat(debtOffsetAmount);
                const safeAmount = Number.isFinite(parsed)
                  ? Math.min(Math.max(parsed, 0), maxOffset)
                  : 0;
                handleReturn({ applyToDebt: true, offsetAmount: safeAmount });
              }}
            >
              Зачесть долг
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Детали возврата</DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                <div>Дата: {new Date(selectedReturn.created_at).toLocaleString("ru-RU")}</div>
                <div>Чек: #{selectedReturn.sale_id}</div>
                <div>Клиент: {selectedReturn.client_name || "-"}</div>
                <div>Сотрудник: {selectedReturn.created_by_name || "-"}</div>
                <div>Тип: {selectedReturn.type}</div>
                <div>Сумма: - {selectedReturn.total_amount.toFixed(2)} ₸</div>
              </div>
              {selectedReturn.reason && (
                <div className="text-sm">
                  <Label>Причина</Label>
                  <p>{selectedReturn.reason}</p>
                </div>
              )}
              <div>
                <Label>Позиции</Label>
                <div className="space-y-1 text-sm">
                  {selectedReturn.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.product_name || `ID ${item.sale_item_id}`}</span>
                      <span>
                        {item.quantity} шт • {item.amount.toFixed(2)} ₸
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
