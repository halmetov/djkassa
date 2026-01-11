import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiUpload } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface WorkshopOrder {
  id: number;
  title: string;
  amount: number;
  customer_name?: string;
  description?: string;
  status: string;
  created_at?: string;
}

export default function WorkshopOrders() {
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("0");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const navigate = useNavigate();

  const loadOrders = async () => {
    try {
      const data = await apiGet<WorkshopOrder[]>("/api/workshop/orders");
      setOrders(data);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить заказы");
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const order = await apiPost<WorkshopOrder>("/api/workshop/orders", {
        title,
        amount: Number(amount) || 0,
        customer_name: customer || undefined,
        description: description || undefined,
      });
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        await apiUpload(`/api/workshop/orders/${order.id}/photo`, formData);
      }
      toast.success("Заказ создан");
      setTitle("");
      setAmount("0");
      setCustomer("");
      setDescription("");
      setPhotoFile(null);
      loadOrders();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось создать заказ");
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Создать заказ</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={createOrder}>
            <Input placeholder="Название заказа" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input type="number" step="0.01" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Заказчик" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <Textarea placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
            <Button type="submit">Создать</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Заказы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="p-3 border rounded-md cursor-pointer hover:bg-muted"
                onClick={() => navigate(`/workshop/orders/${order.id}`)}
              >
                <div className="flex justify-between">
                  <div className="font-semibold">{order.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Статус: {order.status}</div>
                <div className="text-sm">Сумма: {order.amount}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
