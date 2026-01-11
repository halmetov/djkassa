import { useEffect, useState } from "react";
import { apiGet } from "@/api/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Closure {
  id: number;
  order_id: number;
  order_amount: number;
  paid_amount: number;
  note?: string;
  closed_at?: string;
}

export default function WorkshopReport() {
  const [items, setItems] = useState<Closure[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (start) params.append("start_date", start);
      if (end) params.append("end_date", end);
      const data = await apiGet<Closure[]>(`/api/workshop/report${params.toString() ? `?${params.toString()}` : ""}`);
      setItems(data);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить отчет");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 flex-wrap">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Button onClick={load}>Фильтр</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Отчет Цех</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="border p-2 rounded">
              <div className="font-semibold">Заказ #{item.order_id}</div>
              <div className="text-sm">Сумма: {item.order_amount}</div>
              <div className="text-sm">Оплачено: {item.paid_amount}</div>
              <div className="text-xs text-muted-foreground">{item.closed_at ? new Date(item.closed_at).toLocaleString() : ""}</div>
              {item.note && <div className="text-sm text-muted-foreground">{item.note}</div>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
