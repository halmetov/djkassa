import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface OrderType { id: number; name: string; active: boolean }

export default function WorkshopOrderTypes() {
  const [items, setItems] = useState<OrderType[]>([]);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState<OrderType | null>(null);

  const load = async () => setItems(await apiGet<OrderType[]>("/api/workshop/order-types"));
  useEffect(() => { load().catch((e) => toast.error(e?.message || "Не удалось загрузить типы")); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiPut(`/api/workshop/order-types/${editing.id}`, { name, active });
      } else {
        await apiPost("/api/workshop/order-types", { name, active });
      }
      setName(""); setActive(true); setEditing(null); await load();
      toast.success("Сохранено");
    } catch (e: any) { toast.error(e?.message || "Ошибка сохранения"); }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Удалить тип заказа?")) return;
    await apiDelete(`/api/workshop/order-types/${id}`);
    await load();
  };

  return <div className="grid gap-6">
    <Card><CardHeader><CardTitle>Тип заказа</CardTitle></CardHeader><CardContent>
      <form onSubmit={submit} className="grid gap-3 max-w-md">
        <div className="grid gap-1"><Label>Название</Label><Input value={name} onChange={(e)=>setName(e.target.value)} required /></div>
        <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Активен</Label></div>
        <Button type="submit">{editing ? "Сохранить" : "Добавить"}</Button>
      </form>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Список</CardTitle></CardHeader><CardContent className="space-y-2">
      {items.map((item) => <div key={item.id} className="border rounded p-2 flex items-center justify-between">
        <div>{item.name} <span className="text-xs text-muted-foreground">{item.active ? "Активен" : "Неактивен"}</span></div>
        <div className="flex gap-2"><Button variant="outline" onClick={()=>{setEditing(item);setName(item.name);setActive(item.active);}}>Редактировать</Button><Button variant="destructive" onClick={()=>remove(item.id)}>Удалить</Button></div>
      </div>)}
    </CardContent></Card>
  </div>;
}
