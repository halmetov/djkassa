import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Material {
  id: number;
  product_id: number;
  quantity: number;
  unit_price?: number;
}

interface Payment {
  id: number;
  employee_id: number;
  amount: number;
  note?: string;
  created_at: string;
}

interface Order {
  id: number;
  title: string;
  description?: string;
  amount: number;
  status: string;
  customer_name?: string;
  materials: Material[];
  payments: Payment[];
}

export default function ProductionOrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState("open");
  const [materialProductId, setMaterialProductId] = useState("");
  const [materialQty, setMaterialQty] = useState("0");
  const [paymentEmployee, setPaymentEmployee] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentNote, setPaymentNote] = useState("");

  const load = async () => {
    try {
      const data = await apiGet<Order>(`/api/production/orders/${orderId}`);
      setOrder(data);
      setStatus(data.status);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить заказ");
    }
  };

  useEffect(() => {
    if (orderId) {
      load();
    }
  }, [orderId]);

  const updateStatus = async () => {
    try {
      await apiPut(`/api/production/orders/${orderId}`, { status });
      toast.success("Статус обновлен");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось обновить статус");
    }
  };

  const addMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiPost(`/api/production/orders/${orderId}/materials`, {
        product_id: Number(materialProductId),
        quantity: Number(materialQty),
      });
      toast.success("Материал добавлен");
      setMaterialProductId("");
      setMaterialQty("0");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Ошибка при добавлении материала");
    }
  };

  const addPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiPost(`/api/production/orders/${orderId}/payments`, {
        employee_id: Number(paymentEmployee),
        amount: Number(paymentAmount),
        note: paymentNote || undefined,
      });
      toast.success("Выплата добавлена");
      setPaymentEmployee("");
      setPaymentAmount("0");
      setPaymentNote("");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Ошибка при добавлении выплаты");
    }
  };

  if (!order) return <div>Загрузка...</div>;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{order.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>Статус: {order.status}</div>
          <div>Сумма: {order.amount}</div>
          {order.description && <Textarea value={order.description} readOnly />}
          <div className="flex gap-2 items-center">
            <Input value={status} onChange={(e) => setStatus(e.target.value)} />
            <Button onClick={updateStatus}>Обновить статус</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Материалы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="space-y-2" onSubmit={addMaterial}>
              <Input
                placeholder="ID товара"
                value={materialProductId}
                onChange={(e) => setMaterialProductId(e.target.value)}
                required
              />
              <Input
                placeholder="Количество"
                value={materialQty}
                type="number"
                step="0.01"
                onChange={(e) => setMaterialQty(e.target.value)}
              />
              <Button type="submit">Добавить материал</Button>
            </form>
            <div className="space-y-2">
              {order.materials?.map((material) => (
                <div key={material.id} className="border p-2 rounded text-sm">
                  Товар #{material.product_id} • {material.quantity}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Выплаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="space-y-2" onSubmit={addPayment}>
              <Input
                placeholder="ID сотрудника"
                value={paymentEmployee}
                onChange={(e) => setPaymentEmployee(e.target.value)}
                required
              />
              <Input
                placeholder="Сумма"
                value={paymentAmount}
                type="number"
                step="0.01"
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <Textarea placeholder="Заметка" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
              <Button type="submit">Добавить выплату</Button>
            </form>
            <div className="space-y-2">
              {order.payments?.map((payment) => (
                <div key={payment.id} className="border p-2 rounded text-sm">
                  Сотрудник #{payment.employee_id} • {payment.amount} • {new Date(payment.created_at).toLocaleDateString()}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
