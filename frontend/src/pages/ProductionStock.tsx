import { useEffect, useState } from "react";
import { apiGet } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface StockItem {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit?: string;
  barcode?: string;
}

export default function ProductionStock() {
  const [items, setItems] = useState<StockItem[]>([]);

  const load = async () => {
    try {
      const data = await apiGet<StockItem[]>("/api/production/stock");
      setItems(data);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить склад");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Склад Цех</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between border p-2 rounded text-sm">
            <div>
              <div className="font-medium">{item.product_name || `Товар #${item.product_id}`}</div>
              {item.barcode && <div className="text-xs text-muted-foreground">{item.barcode}</div>}
            </div>
            <div>
              {item.quantity} {item.unit}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
