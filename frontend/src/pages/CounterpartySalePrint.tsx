import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type CounterpartySaleItem = {
  id: number;
  product_id: number;
  product_name?: string | null;
  quantity: number;
  price: number;
};

type CounterpartySaleDetail = {
  id: number;
  created_at: string;
  created_by_name?: string | null;
  counterparty_name?: string | null;
  counterparty_company_name?: string | null;
  counterparty_phone?: string | null;
  items: CounterpartySaleItem[];
};

const formatAmount = (value?: number | null) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);

export default function CounterpartySalePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState<CounterpartySaleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const detail = await apiGet<CounterpartySaleDetail>(`/api/counterparty-sales/${id}`);
        setSale(detail);
      } catch (error) {
        console.error(error);
        toast.error("Не удалось загрузить накладную");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id]);

  const totalAmount = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  }, [sale]);

  return (
    <div className="print-page space-y-4">
      <div className="no-print flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Назад
        </Button>
        <Button onClick={() => window.print()}>Печать</Button>
      </div>

      <Card className="print-container p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-2xl font-bold">Накладная</div>
              <div className="text-sm text-muted-foreground">Компания: __________________</div>
            </div>
            <div className="text-sm">
              <div>Контрагент: {sale?.counterparty_name || "-"}</div>
              <div>Фирма: {sale?.counterparty_company_name || "-"}</div>
              <div>Телефон: {sale?.counterparty_phone || "-"}</div>
              <div>Дата: {sale ? new Date(sale.created_at).toLocaleString("ru-RU") : "-"}</div>
            </div>
          </div>

          {isLoading && <div className="text-sm text-muted-foreground">Загрузка...</div>}

          {!isLoading && sale && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left">Код / Название</th>
                      <th className="py-2 text-right">Кол-во</th>
                      <th className="py-2 text-right">Цена</th>
                      <th className="py-2 text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">
                          <div className="font-medium">{item.product_name || "Товар"}</div>
                          <div className="text-xs text-muted-foreground">#{item.product_id}</div>
                        </td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">{formatAmount(item.price)} ₸</td>
                        <td className="py-2 text-right">{formatAmount(item.quantity * item.price)} ₸</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end gap-1 text-sm">
                <div className="text-lg font-semibold">Итого: {formatAmount(totalAmount)} ₸</div>
                <div className="text-muted-foreground">Создал: {sale.created_by_name || "-"}</div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
