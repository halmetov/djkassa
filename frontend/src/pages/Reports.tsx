import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { apiGet } from "@/api/client";
import { toast } from "sonner";
import { PrintableReceipt } from "@/components/PrintableReceipt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOutletContext } from "react-router-dom";

type SaleSummary = {
  id: number;
  entry_type?: string;
  created_at: string;
  seller_name?: string | null;
  seller_id?: number | null;
  branch_name?: string | null;
  branch_id?: number | null;
  client_name?: string | null;
  total_amount: number;
  payment_type: string;
  paid_cash: number;
  paid_card: number;
  paid_debt: number;
};

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
  branch_address?: string | null;
  seller_name?: string | null;
  client_name?: string | null;
  total_amount: number;
  paid_cash: number;
  paid_card: number;
  paid_debt: number;
  payment_type: string;
  items: SaleDetailItem[];
};

export default function Reports() {
  const { user } = useOutletContext<{ user: { id: number; role: string } | null; isAdmin: boolean }>();
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [sellers, setSellers] = useState<{ id: number; name: string }[]>([]);
  const [sellerFilter, setSellerFilter] = useState<string | null>("all");

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
    fetchSales(start, end);
    loadSellers();
  }, []);

  const loadSellers = async () => {
    try {
      const users = await apiGet<{ id: number; name: string }[]>("/api/users");
      const validUsers = (users || []).filter((u) => u.id !== null && u.id !== undefined);
      setSellers(validUsers);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSales = async (start?: Date, end?: Date, sellerId?: string) => {
    try {
      const params = new URLSearchParams();
      if (start) params.set("start_date", start.toISOString().split('T')[0]);
      if (end) params.set("end_date", end.toISOString().split('T')[0]);
      const seller = sellerId ?? sellerFilter;
      if (seller && seller !== "all") params.set("seller_id", seller);
      const data = await apiGet<SaleSummary[]>(`/api/sales${params.toString() ? `?${params.toString()}` : ""}`);
      setSales(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить отчеты");
    }
  };

  const handleFilter = () => {
    if (startDate && endDate) {
      fetchSales(new Date(startDate), new Date(endDate));
    }
  };

  const viewDetails = async (sale: SaleSummary) => {
    if (sale.entry_type && sale.entry_type !== "sale") {
      toast.info("Детали доступны только для продаж");
      return;
    }
    try {
      const detail = await apiGet<SaleDetail>(`/api/sales/${sale.id}`);
      setSelectedSale(detail);
      setShowDetailsModal(true);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить детали продажи");
    }
  };

  const getTotalSales = () => sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const getTotalCash = () => sales.reduce((sum, sale) => sum + sale.paid_cash, 0);
  const getTotalCard = () => sales.reduce((sum, sale) => sum + sale.paid_card, 0);
  const getTotalCredit = () =>
    sales
      .filter((sale) => !sale.entry_type || sale.entry_type === "sale")
      .reduce((sum, sale) => sum + sale.paid_debt, 0);

  const entryLabels: Record<string, string> = {
    sale: "Продажа",
    return: "Возврат",
    debt_payment: "Погашение долга",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Отчеты</h1>
        <p className="text-muted-foreground">История продаж</p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label>Дата начала</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Дата окончания</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleFilter} className="w-full">
              Применить фильтр
            </Button>
          </div>
          <div>
            <Label>Сотрудник</Label>
            <Select
              value={sellerFilter ?? undefined}
              onValueChange={(val) => {
                setSellerFilter(val);
                if (startDate && endDate) {
                  fetchSales(new Date(startDate), new Date(endDate), val);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все сотрудники" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {sellers
                  .filter((s) => s.id !== null && s.id !== undefined)
                  .map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Всего продаж</div>
            <div className="text-2xl font-bold">{getTotalSales().toFixed(2)} ₸</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Наличные</div>
            <div className="text-2xl font-bold">{getTotalCash().toFixed(2)} ₸</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Карта</div>
            <div className="text-2xl font-bold">{getTotalCard().toFixed(2)} ₸</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">В долг</div>
            <div className="text-2xl font-bold">{getTotalCredit().toFixed(2)} ₸</div>
          </Card>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="text-right">Наличные</TableHead>
              <TableHead className="text-right">Карта</TableHead>
              <TableHead className="text-right">Долг</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>{new Date(sale.created_at).toLocaleString('ru-RU')}</TableCell>
                <TableCell>{entryLabels[sale.entry_type || "sale"] || "Операция"}</TableCell>
                <TableCell>{sale.seller_name || "-"}</TableCell>
                <TableCell>{sale.branch_name || "-"}</TableCell>
                <TableCell className="text-right font-medium">{sale.total_amount.toFixed(2)} ₸</TableCell>
                <TableCell className="text-right">{sale.paid_cash.toFixed(2)} ₸</TableCell>
                <TableCell className="text-right">{sale.paid_card.toFixed(2)} ₸</TableCell>
                <TableCell className="text-right">{sale.paid_debt.toFixed(2)} ₸</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => viewDetails(sale)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Детали продажи</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Дата: {new Date(selectedSale.created_at).toLocaleString('ru-RU')}</div>
                <div>Филиал: {selectedSale.branch_name || "-"}</div>
                <div>Адрес: {selectedSale.branch_address || "-"}</div>
                <div>Сотрудник: {selectedSale.seller_name || "-"}</div>
                <div>Клиент: {selectedSale.client_name || "-"}</div>
                <div>Оплата: {selectedSale.payment_type}</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="text-right">Количество</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSale.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name || `ID ${item.product_id}`}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.product_unit || "шт"}
                      </TableCell>
                      <TableCell className="text-right">{item.price.toFixed(2)} ₸</TableCell>
                      <TableCell className="text-right">{(item.total || item.price * item.quantity).toFixed(2)} ₸</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PrintableReceipt sale={selectedSale} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
