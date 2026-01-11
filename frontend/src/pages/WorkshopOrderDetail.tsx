import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface Material {
  id: number;
  product_id: number;
  product_name: string;
  product_barcode?: string;
  quantity: number;
  unit?: string;
  created_at?: string;
}

interface Payout {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_phone?: string;
  employee_position?: string;
  amount: number;
  note?: string;
  created_at?: string;
}

interface Order {
  id: number;
  title: string;
  description?: string;
  amount: number;
  status: string;
  customer_name?: string;
  materials: Material[];
  payouts: Payout[];
  closed_at?: string | null;
  paid_amount?: number | null;
  photo?: string | null;
}

interface StockProduct {
  id: number;
  product_id?: number;
  name: string;
  quantity: number;
  unit?: string;
  barcode?: string;
  photo?: string | null;
  image_url?: string | null;
}

interface EmployeeOption {
  id: number;
  full_name: string;
  phone?: string;
  salary_total: number;
  position?: string;
}

export default function WorkshopOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id);
  const [order, setOrder] = useState<Order | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialOptions, setMaterialOptions] = useState<StockProduct[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<StockProduct | null>(null);
  const [materialQty, setMaterialQty] = useState("1");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentNote, setPaymentNote] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [closeNote, setCloseNote] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const load = async () => {
    try {
      const data = await apiGet<Order>(`/api/workshop/orders/${orderId}`);
      setOrder(data);
      setPaidAmount(data.paid_amount != null ? String(data.paid_amount) : "0");
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить заказ");
    }
  };

  useEffect(() => {
    if (orderId) {
      load();
    }
  }, [orderId]);

  useEffect(() => {
    if (!materialOpen) return;
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (materialSearch) params.set("q", materialSearch);
        const data = await apiGet<StockProduct[]>(`/api/workshop/stock/products?${params.toString()}`);
        setMaterialOptions(data);
      } catch (error: any) {
        toast.error(error?.message || "Не удалось загрузить материалы");
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [materialSearch, materialOpen]);

  useEffect(() => {
    if (!employeeOpen) return;
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (employeeSearch) params.set("q", employeeSearch);
        const data = await apiGet<EmployeeOption[]>(`/api/workshop/employees/search?${params.toString()}`);
        setEmployeeOptions(data);
      } catch (error: any) {
        toast.error(error?.message || "Не удалось найти сотрудников");
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [employeeSearch, employeeOpen]);

  const handleClosedState = (error: any) => {
    toast.error(error?.message || "Ошибка запроса");
    if (error?.status === 409 || error?.status === 403 || String(error?.message || "").includes("Order is closed")) {
      load();
    }
  };

  const addMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedMaterial) {
      toast.error("Выберите материал");
      return;
    }
    try {
      await apiPost(`/api/workshop/orders/${orderId}/materials`, {
        product_id: selectedMaterial.id || selectedMaterial.product_id,
        quantity: Number(materialQty) || 0,
        unit: selectedMaterial.unit,
      });
      toast.success("Материал добавлен");
      setMaterialSearch("");
      setSelectedMaterial(null);
      setMaterialQty("1");
      load();
    } catch (error: any) {
      handleClosedState(error);
    }
  };

  const addPayout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployee) {
      toast.error("Выберите сотрудника");
      return;
    }
    try {
      await apiPost(`/api/workshop/orders/${orderId}/payouts`, {
        employee_id: selectedEmployee.id,
        amount: Number(paymentAmount) || 0,
        note: paymentNote || undefined,
      });
      toast.success("Выплата добавлена");
      setSelectedEmployee(null);
      setEmployeeSearch("");
      setPaymentAmount("0");
      setPaymentNote("");
      load();
    } catch (error: any) {
      handleClosedState(error);
    }
  };

  const closeOrder = async () => {
    try {
      await apiPost(`/api/workshop/orders/${orderId}/close`, {
        paid_amount: Number(paidAmount) || 0,
        note: closeNote || undefined,
      });
      toast.success("Заказ закрыт");
      setCloseDialogOpen(false);
      load();
    } catch (error: any) {
      handleClosedState(error);
    }
  };

  const updateOrder = async () => {
    if (!order) return;
    try {
      await apiPut(`/api/workshop/orders/${orderId}`, {
        title: order.title,
        amount: order.amount,
        description: order.description,
        customer_name: order.customer_name,
        status: order.status,
      });
      toast.success("Заказ обновлен");
    } catch (error: any) {
      handleClosedState(error);
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile) {
      toast.error("Выберите файл");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      const updated = await apiUpload<Order>(`/api/workshop/orders/${orderId}/photo`, formData);
      setOrder((prev) => (prev ? { ...prev, ...(updated || {}) } : updated));
      setPhotoFile(null);
      toast.success("Фото загружено");
    } catch (error: any) {
      handleClosedState(error);
    }
  };

  const deleteOrder = async () => {
    if (!orderId) return;
    const confirmed = window.confirm("Точно удалить заказ?");
    if (!confirmed) return;
    try {
      await apiDelete(`/api/workshop/orders/${orderId}`);
      toast.success("Заказ удален");
      navigate("/workshop/orders");
    } catch (error: any) {
      toast.error(error?.message || "Не удалось удалить заказ");
    }
  };

  if (!order) return <div>Загрузка...</div>;

  const isClosed = order.status === "closed";

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{order.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>Статус: {order.status}</span>
            {order.closed_at && <span>Закрыт: {new Date(order.closed_at).toLocaleString()}</span>}
            {order.paid_amount != null && <span>Оплачено клиентом: {order.paid_amount}</span>}
          </div>
          <Input value={order.title} onChange={(e) => setOrder({ ...order, title: e.target.value })} disabled={isClosed} />
          <Input
            type="number"
            value={order.amount}
            onChange={(e) => setOrder({ ...order, amount: Number(e.target.value) })}
            disabled={isClosed}
          />
          <Input
            placeholder="Статус"
            value={order.status}
            onChange={(e) => setOrder({ ...order, status: e.target.value })}
            disabled={isClosed}
          />
          <Input
            placeholder="Заказчик"
            value={order.customer_name || ""}
            onChange={(e) => setOrder({ ...order, customer_name: e.target.value })}
            disabled={isClosed}
          />
          <Textarea
            value={order.description || ""}
            onChange={(e) => setOrder({ ...order, description: e.target.value })}
            placeholder="Описание"
            disabled={isClosed}
          />
          {order.photo && (
            <img src={order.photo} alt="Фото заказа" className="max-h-64 rounded border" />
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              disabled={isClosed}
            />
            <Button variant="secondary" onClick={uploadPhoto} disabled={!photoFile || isClosed}>
              Загрузить фото
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={updateOrder} disabled={isClosed}>
              Сохранить
            </Button>
            {!isClosed && (
              <Button
                variant="secondary"
                onClick={() => {
                  setPaidAmount(String(order.amount || 0));
                  setCloseDialogOpen(true);
                }}
              >
                Завершить заказ
              </Button>
            )}
            <Button variant="destructive" onClick={deleteOrder}>
              Удалить заказ
            </Button>
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
              <Popover open={materialOpen} onOpenChange={(open) => setMaterialOpen(open && !isClosed)}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={isClosed}
                    onClick={() => {
                      setMaterialOpen(!materialOpen);
                      setMaterialSearch("");
                    }}
                  >
                    {selectedMaterial ? selectedMaterial.name : "Выберите материал"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[360px]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Поиск по названию или штрихкоду"
                      value={materialSearch}
                      onValueChange={setMaterialSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Ничего не найдено</CommandEmpty>
                      <CommandGroup>
                        {materialOptions.map((option) => (
                          <CommandItem
                            key={option.id || option.product_id}
                            onSelect={() => {
                              setSelectedMaterial(option);
                              setMaterialSearch(option.name);
                              setMaterialOpen(false);
                            }}
                            className="flex flex-col items-start gap-1"
                          >
                            <div className="font-semibold">{option.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Остаток: {option.quantity} {option.unit || ""}
                              {option.barcode ? ` • ${option.barcode}` : ""}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Input
                placeholder="Количество"
                value={materialQty}
                type="number"
                step="0.01"
                min={0.01}
                onChange={(e) => setMaterialQty(e.target.value)}
                required
                disabled={isClosed}
              />
              <Button type="submit" disabled={!selectedMaterial || isClosed}>
                Добавить материал
              </Button>
            </form>
            <div className="space-y-2">
              {order.materials?.map((material) => (
                <div key={material.id} className="border p-2 rounded text-sm">
                  {material.product_name} ({material.product_id}) • {material.quantity} {material.unit || ""}
                  {material.product_barcode ? ` • ${material.product_barcode}` : ""}
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
            <form className="space-y-2" onSubmit={addPayout}>
              <Popover open={employeeOpen} onOpenChange={(open) => setEmployeeOpen(open && !isClosed)}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={isClosed}
                    onClick={() => {
                      setEmployeeOpen(!employeeOpen);
                      setEmployeeSearch("");
                    }}
                  >
                    {selectedEmployee ? selectedEmployee.full_name : "Выберите сотрудника"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[340px]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Поиск по имени, позиции или телефону"
                      value={employeeSearch}
                      onValueChange={setEmployeeSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Ничего не найдено</CommandEmpty>
                      <CommandGroup>
                        {employeeOptions.map((employee) => (
                          <CommandItem
                            key={employee.id}
                            onSelect={() => {
                              setSelectedEmployee(employee);
                              setEmployeeSearch(employee.full_name);
                              setEmployeeOpen(false);
                            }}
                            className="flex flex-col items-start gap-1"
                          >
                            <div className="font-semibold">{employee.full_name}</div>
                            {employee.position && (
                              <div className="text-xs text-muted-foreground">{employee.position}</div>
                            )}
                            {employee.phone && <div className="text-xs text-muted-foreground">{employee.phone}</div>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Input
                placeholder="Сумма"
                value={paymentAmount}
                type="number"
                step="0.01"
                onChange={(e) => setPaymentAmount(e.target.value)}
                disabled={isClosed}
              />
              <Textarea
                placeholder="Заметка"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                disabled={isClosed}
              />
              <Button type="submit" disabled={!selectedEmployee || isClosed}>
                Добавить выплату
              </Button>
            </form>
            <div className="space-y-2">
              {order.payouts?.map((payment) => (
                <div key={payment.id} className="border p-2 rounded text-sm space-y-1">
                  <div className="font-medium">
                    {payment.employee_name} ({payment.employee_id})
                  </div>
                  <div>Сумма: {payment.amount}</div>
                  {payment.employee_position && (
                    <div className="text-muted-foreground text-xs">{payment.employee_position}</div>
                  )}
                  {payment.created_at && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </div>
                  )}
                  {payment.note && <div className="text-xs">{payment.note}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сколько оплатил клиент?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Оплачено"
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
            <Textarea placeholder="Комментарий" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={closeOrder}>Завершить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
