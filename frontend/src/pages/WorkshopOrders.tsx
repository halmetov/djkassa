import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiUpload } from "@/api/client";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface TemplateOption {
  id: number;
  name: string;
}

interface TemplateItem {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit?: string;
}

interface TemplateDetail {
  id: number;
  name: string;
  items: TemplateItem[];
}

export default function WorkshopOrders() {
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("0");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [canUseTemplates, setCanUseTemplates] = useState(false);
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

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      setCanUseTemplates(user?.role === "admin" || user?.role === "production_manager");
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!canUseTemplates) return;
    if (!templateOpen) return;
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (templateSearch) params.set("query", templateSearch);
        const data = await apiGet<TemplateOption[]>(`/api/workshop/templates?${params.toString()}`);
        setTemplateOptions(data);
      } catch (error: any) {
        toast.error(error?.message || "Не удалось загрузить шаблоны");
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [templateSearch, templateOpen, canUseTemplates]);

  const selectTemplate = async (templateId: number | null) => {
    if (!templateId) {
      setSelectedTemplate(null);
      return;
    }
    try {
      const data = await apiGet<TemplateDetail>(`/api/workshop/templates/${templateId}`);
      setSelectedTemplate(data);
      setTitle(data.name);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить шаблон");
    }
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const order = await apiPost<WorkshopOrder>("/api/workshop/orders", {
        title,
        amount: Number(amount) || 0,
        customer_name: customer || undefined,
        description: description || undefined,
        template_id: selectedTemplate?.id || undefined,
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
      setSelectedTemplate(null);
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
            {canUseTemplates && (
              <>
                <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" type="button">
                      {selectedTemplate ? selectedTemplate.name : "Шаблон (необязательно)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Поиск шаблонов"
                        value={templateSearch}
                        onValueChange={setTemplateSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Шаблоны не найдены</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setTemplateOpen(false);
                              selectTemplate(null);
                            }}
                          >
                            Без шаблона
                          </CommandItem>
                          {templateOptions.map((option) => (
                            <CommandItem
                              key={option.id}
                              onSelect={() => {
                                setTemplateOpen(false);
                                selectTemplate(option.id);
                              }}
                            >
                              {option.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedTemplate && (
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-semibold">Материалы шаблона</div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {selectedTemplate.items.length ? (
                        selectedTemplate.items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span>{item.product_name || "Материал"}</span>
                            <span>
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div>Материалы не добавлены</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
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
