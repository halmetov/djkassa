import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface TemplateListItem {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  items_count: number;
  photo?: string;
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
  description?: string;
  active: boolean;
  amount?: number;
  order_type_id?: number;
  photo?: string;
  items: TemplateItem[];
}

interface DictOption { id: number; name?: string }

interface StockProduct {
  id: number;
  product_id?: number;
  name: string;
  quantity: number;
  unit?: string;
  barcode?: string;
}

export default function WorkshopTemplates() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [search, setSearch] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [createAmount, setCreateAmount] = useState("0");
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialOptions, setMaterialOptions] = useState<StockProduct[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<StockProduct | null>(null);
  const [materialQty, setMaterialQty] = useState("1");
  const [orderTypes, setOrderTypes] = useState<DictOption[]>([]);
  const [createOrderTypeId, setCreateOrderTypeId] = useState("");

  const loadTemplates = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("query", search);
      const data = await apiGet<TemplateListItem[]>(`/api/workshop/templates?${params.toString()}`);
      setTemplates(data);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить шаблоны");
    }
  };

  const loadTemplateDetail = async (templateId: number) => {
    try {
      const data = await apiGet<TemplateDetail>(`/api/workshop/templates/${templateId}`);
      setSelectedTemplate(data);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить шаблон");
    }
  };

  useEffect(() => {
    loadTemplates();
    apiGet<DictOption[]>("/api/workshop/order-types?active=true").then(setOrderTypes).catch(() => undefined);
  }, []);

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

  const createTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const created = await apiPost<TemplateDetail>("/api/workshop/templates", {
        name: createName,
        description: createDescription || undefined,
        amount: Number(createAmount) || 0,
        order_type_id: createOrderTypeId ? Number(createOrderTypeId) : undefined,
        items: [],
      });
      toast.success("Шаблон создан");
      setCreateName("");
      setCreateDescription("");
      setCreateAmount("0");
      setCreateOrderTypeId("");
      setSelectedTemplate(created);
      loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось создать шаблон");
    }
  };

  const updateTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await apiPut<TemplateDetail>(`/api/workshop/templates/${selectedTemplate.id}`, {
        name: selectedTemplate.name,
        description: selectedTemplate.description || undefined,
        active: selectedTemplate.active,
        amount: selectedTemplate.amount || 0,
      });
      setSelectedTemplate(null);
      toast.success("Шаблон обновлен");
      loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось обновить шаблон");
    }
  };


  const uploadTemplatePhoto = async (file: File) => {
    if (!selectedTemplate) return;
    try {
      const formData = new FormData();
      formData.append("photo_file", file);
      const updated = await apiUpload<TemplateDetail>(`/api/workshop/templates/${selectedTemplate.id}/photo`, formData);
      setSelectedTemplate(updated);
      loadTemplates();
      toast.success("Фото шаблона обновлено");
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить фото шаблона");
    }
  };

  const removeTemplate = async (templateId: number) => {
    const confirmed = window.confirm("Удалить шаблон?");
    if (!confirmed) return;
    try {
      await apiDelete(`/api/workshop/templates/${templateId}`);
      toast.success("Шаблон удален");
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
      loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось удалить шаблон");
    }
  };

  const addItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTemplate) return;
    if (!selectedMaterial) {
      toast.error("Выберите материал");
      return;
    }
    try {
      await apiPost(`/api/workshop/templates/${selectedTemplate.id}/items`, {
        product_id: selectedMaterial.id || selectedMaterial.product_id,
        quantity: Number(materialQty) || 0,
      });
      toast.success("Материал добавлен");
      setSelectedMaterial(null);
      setMaterialSearch("");
      setMaterialQty("1");
      loadTemplateDetail(selectedTemplate.id);
      loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось добавить материал");
    }
  };

  const updateItem = async (item: TemplateItem, nextQty: string) => {
    if (!selectedTemplate) return;
    try {
      await apiPut(`/api/workshop/templates/${selectedTemplate.id}/items/${item.id}`, {
        quantity: Number(nextQty) || 0,
      });
      toast.success("Количество обновлено");
      loadTemplateDetail(selectedTemplate.id);
      loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось обновить количество");
    }
  };

  const removeItem = async (itemId: number) => {
    if (!selectedTemplate) return;
    try {
      await apiDelete(`/api/workshop/templates/${selectedTemplate.id}/items/${itemId}`);
      toast.success("Материал удален");
      loadTemplateDetail(selectedTemplate.id);
      loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось удалить материал");
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Создать шаблон</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={createTemplate}>
            <div className="grid gap-1"><Label>Название заказа</Label><Input value={createName} onChange={(event) => setCreateName(event.target.value)} required /></div>
            <div className="grid gap-1"><Label>Сумма</Label><Input type="number" step="0.01" value={createAmount} onChange={(event) => setCreateAmount(event.target.value)} /></div>
            <div className="grid gap-1"><Label>Тип заказа</Label><select className="border rounded h-10 px-3 bg-background" value={createOrderTypeId} onChange={(event) => setCreateOrderTypeId(event.target.value)}><option value="">Не выбран</option>{orderTypes.map((item)=><option key={item.id} value={item.id}>{item.name || `#${item.id}`}</option>)}</select></div>
            <div className="grid gap-1"><Label>Описание</Label><Textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} /></div>
            <div className="grid gap-1"><Label>Фото</Label><Input placeholder="Сначала создайте шаблон, затем загрузите фото в режиме редактирования" disabled /></div>
            <Button type="submit">Создать шаблон</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Частые заказы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Поиск по названию"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-sm"
            />
            <Button onClick={loadTemplates}>Поиск</Button>
          </div>
          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template.id} className="flex items-center justify-between border p-2 rounded">
                <div>
                  <div className="font-semibold">{template.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Материалов: {template.items_count}
                  </div>
                  {template.description && (
                    <div className="text-xs text-muted-foreground">{template.description}</div>
                  )}
                  {template.photo && (
                    <img src={template.photo} alt={template.name} className="mt-2 h-12 w-12 rounded object-cover border" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => loadTemplateDetail(template.id)}>
                    Открыть
                  </Button>
                  <Button variant="destructive" onClick={() => removeTemplate(template.id)}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Редактирование шаблона</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Input
                placeholder="Название"
                value={selectedTemplate.name}
                onChange={(event) =>
                  setSelectedTemplate((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
              <Textarea
                placeholder="Описание"
                value={selectedTemplate.description || ""}
                onChange={(event) =>
                  setSelectedTemplate((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedTemplate.active}
                  onCheckedChange={(value) =>
                    setSelectedTemplate((prev) => (prev ? { ...prev, active: value } : prev))
                  }
                />
                <span className="text-sm">Активен</span>
              </div>
              {selectedTemplate.photo && (
                <img src={selectedTemplate.photo} alt={selectedTemplate.name} className="h-28 w-28 rounded object-cover border" />
              )}
              <div className="grid gap-1">
                <Label>Загрузить фото</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadTemplatePhoto(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              <Button onClick={updateTemplate}>Сохранить шаблон</Button>
            </div>

            <div className="space-y-3">
              <div className="font-semibold">Материалы шаблона</div>
              <form className="flex flex-wrap gap-2 items-center" onSubmit={addItem}>
                <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" type="button">
                      {selectedMaterial ? selectedMaterial.name : "Выберите материал"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Поиск материалов"
                        value={materialSearch}
                        onValueChange={setMaterialSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Материалы не найдены</CommandEmpty>
                        <CommandGroup>
                          {materialOptions.map((option) => (
                            <CommandItem
                              key={option.id}
                              onSelect={() => {
                                setSelectedMaterial(option);
                                setMaterialOpen(false);
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
                <Input
                  type="number"
                  step="0.01"
                  className="w-28"
                  value={materialQty}
                  onChange={(event) => setMaterialQty(event.target.value)}
                />
                <Button type="submit">Добавить</Button>
              </form>
              <div className="space-y-2">
                {selectedTemplate.items.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between border p-2 rounded">
                    <div>
                      <div className="font-medium">{item.product_name || "Материал"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.unit ? `Ед.: ${item.unit}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={String(item.quantity)}
                        className="w-28"
                        onBlur={(event) => updateItem(item, event.target.value)}
                      />
                      <Button variant="destructive" onClick={() => removeItem(item.id)}>
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))}
                {!selectedTemplate.items.length && (
                  <div className="text-sm text-muted-foreground">Материалы не добавлены</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
