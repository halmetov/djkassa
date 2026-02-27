import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiUpload } from "@/api/client";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface WorkshopOrder { id: number; title: string; amount: number; status: string; created_at?: string }
interface TemplateOption { id: number; name: string }
interface TemplateItem { id: number; product_name?: string; quantity: number; unit?: string }
interface TemplateDetail {
  id: number;
  name: string;
  description?: string;
  amount?: number;
  order_type_id?: number;
  photo?: string;
  items: TemplateItem[];
}
interface DictOption { id: number; name?: string; phone?: string }

export default function WorkshopOrders() {
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [title, setTitle] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [orderTypeId, setOrderTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [templatePhoto, setTemplatePhoto] = useState<string | null>(null);
  const [customers, setCustomers] = useState<DictOption[]>([]);
  const [orderTypes, setOrderTypes] = useState<DictOption[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [canUseTemplates, setCanUseTemplates] = useState(false);
  const navigate = useNavigate();

  const numericQuantity = Math.max(1, Number(quantity) || 1);
  const numericUnitPrice = Number(unitPrice) || 0;
  const calculatedTotal = useMemo(() => numericUnitPrice * numericQuantity, [numericUnitPrice, numericQuantity]);

  const loadOrders = async () => setOrders(await apiGet<WorkshopOrder[]>("/api/workshop/orders"));

  useEffect(() => {
    loadOrders().catch((e) => toast.error(e?.message || "Не удалось загрузить заказы"));
    apiGet<DictOption[]>("/api/workshop/customers?active=true").then(setCustomers).catch(() => undefined);
    apiGet<DictOption[]>("/api/workshop/order-types?active=true").then(setOrderTypes).catch(() => undefined);
  }, []);

  useEffect(() => { getCurrentUser().then((user) => setCanUseTemplates(user?.role === "admin" || user?.role === "production_manager")); }, []);
  useEffect(() => {
    if (!canUseTemplates || !templateOpen) return;
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (templateSearch) params.set("query", templateSearch);
      setTemplateOptions(await apiGet<TemplateOption[]>(`/api/workshop/templates?${params.toString()}`));
    }, 250);
    return () => clearTimeout(handle);
  }, [templateSearch, templateOpen, canUseTemplates]);

  const selectTemplate = async (templateId: number | null) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setTemplatePhoto(null);
      return;
    }
    const data = await apiGet<TemplateDetail>(`/api/workshop/templates/${templateId}`);
    setSelectedTemplate(data);
    setTitle(data.name || "");
    setDescription(data.description || "");
    setOrderTypeId(data.order_type_id ? String(data.order_type_id) : "");
    setUnitPrice(String(data.amount || 0));
    setTemplatePhoto(data.photo || null);
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orderTypeId) {
      toast.error("Выберите тип заказа");
      return;
    }
    if (newCustomerMode && !newCustomerName.trim()) {
      toast.error("Введите имя нового заказчика");
      return;
    }
    try {
      const order = await apiPost<WorkshopOrder>("/api/workshop/orders", {
        title,
        amount: numericUnitPrice,
        unit_price: numericUnitPrice,
        quantity: numericQuantity,
        customer_id: !newCustomerMode && customerId ? Number(customerId) : undefined,
        customer_new_name: newCustomerMode ? newCustomerName.trim() : undefined,
        customer_new_phone: newCustomerMode ? (newCustomerPhone.trim() || undefined) : undefined,
        order_type_id: Number(orderTypeId),
        description: description || undefined,
        template_id: selectedTemplate?.id || undefined,
      });
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        await apiUpload(`/api/workshop/orders/${order.id}/photo`, formData);
      }
      setTitle(""); setUnitPrice("0"); setQuantity("1"); setCustomerId(""); setOrderTypeId(""); setDescription(""); setPhotoFile(null); setSelectedTemplate(null); setTemplatePhoto(null); setNewCustomerMode(false); setNewCustomerName(""); setNewCustomerPhone("");
      await loadOrders(); toast.success("Заказ создан");
    } catch (error: any) { toast.error(error?.message || "Не удалось создать заказ"); }
  };

  return <div className="grid gap-6">
    <Card><CardHeader><CardTitle>Создать заказ</CardTitle></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={createOrder}>
        {canUseTemplates && <Popover open={templateOpen} onOpenChange={setTemplateOpen}><PopoverTrigger asChild><Button variant="outline" type="button">{selectedTemplate ? selectedTemplate.name : "Шаблон (необязательно)"}</Button></PopoverTrigger><PopoverContent className="p-0" align="start"><Command><CommandInput placeholder="Поиск шаблонов" value={templateSearch} onValueChange={setTemplateSearch} /><CommandList><CommandEmpty>Шаблоны не найдены</CommandEmpty><CommandGroup><CommandItem onSelect={() => { setTemplateOpen(false); selectTemplate(null); }}>Без шаблона</CommandItem>{templateOptions.map((option) => <CommandItem key={option.id} onSelect={() => { setTemplateOpen(false); selectTemplate(option.id); }}>{option.name}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>}

        <div className="grid gap-1"><Label>Название заказа</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} required /></div>
        <div className="grid gap-1"><Label>Цена за 1 шт (unit)</Label><Input type="number" step="0.01" value={unitPrice} onChange={(e)=>setUnitPrice(e.target.value)} /></div>
        <div className="grid gap-1"><Label>Количество</Label><Input type="number" min={1} value={quantity} onChange={(e)=>setQuantity(e.target.value)} required /></div>
        <div className="rounded border p-2 text-sm">Итоговая сумма: <span className="font-semibold">{calculatedTotal.toFixed(2)}</span></div>
        <div className="grid gap-1"><Label>Тип заказа *</Label><select required className="border rounded h-10 px-3 bg-background" value={orderTypeId} onChange={(e)=>setOrderTypeId(e.target.value)}><option value="">Выберите тип</option>{orderTypes.map((c)=><option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}</select></div>
        <div className="flex items-center gap-2 text-sm"><input id="new-customer" type="checkbox" checked={newCustomerMode} onChange={(e)=>setNewCustomerMode(e.target.checked)} /><Label htmlFor="new-customer">Новый заказчик</Label></div>
        {!newCustomerMode ? (
          <div className="grid gap-1"><Label>Заказчик</Label><select className="border rounded h-10 px-3 bg-background" value={customerId} onChange={(e)=>setCustomerId(e.target.value)}><option value="">Не выбран</option>{customers.map((c)=><option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}</select></div>
        ) : (
          <>
            <div className="grid gap-1"><Label>Имя заказчика *</Label><Input value={newCustomerName} onChange={(e)=>setNewCustomerName(e.target.value)} required={newCustomerMode} /></div>
            <div className="grid gap-1"><Label>Телефон</Label><Input value={newCustomerPhone} onChange={(e)=>setNewCustomerPhone(e.target.value)} /></div>
          </>
        )}
        <div className="grid gap-1"><Label>Описание</Label><Textarea value={description} onChange={(e)=>setDescription(e.target.value)} /></div>
        {templatePhoto && <img src={templatePhoto} alt="Фото шаблона" className="h-24 w-24 rounded border object-cover" />}
        {selectedTemplate && selectedTemplate.items.length > 0 && (
          <div className="rounded border p-3 text-sm space-y-1">
            <div className="font-medium">Материалы по шаблону (пересчет):</div>
            {selectedTemplate.items.map((item) => <div key={item.id}>{item.product_name || `#${item.id}`}: {(item.quantity * numericQuantity).toFixed(2)} {item.unit || "шт"}</div>)}
          </div>
        )}
        <div className="grid gap-1"><Label>Фото</Label><Input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} /></div>
        <Button type="submit">Создать</Button>
      </form>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Заказы</CardTitle></CardHeader><CardContent><div className="space-y-2">{orders.map((order) => <div key={order.id} className="p-3 border rounded-md cursor-pointer hover:bg-muted" onClick={() => navigate(`/workshop/orders/${order.id}`)}><div className="flex justify-between"><div className="font-semibold">{order.title}</div><div className="text-sm text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}</div></div><div className="text-sm text-muted-foreground">Статус: {order.status}</div><div className="text-sm">Сумма: {order.amount}</div></div>)}</div></CardContent></Card>
  </div>;
}
