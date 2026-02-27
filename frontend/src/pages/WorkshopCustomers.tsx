import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Customer { id: number; name?: string; phone?: string; debt?: number; active: boolean }

export default function WorkshopCustomers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", debt: "0", active: true });
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = async () => setItems(await apiGet<Customer[]>("/api/workshop/customers"));
  useEffect(() => { load().catch((e) => toast.error(e?.message || "Не удалось загрузить заказчиков")); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name || undefined, phone: form.phone || undefined, debt: Number(form.debt || 0), active: form.active };
    try {
      if (editing) await apiPut(`/api/workshop/customers/${editing.id}`, payload);
      else await apiPost(`/api/workshop/customers`, payload);
      setForm({ name: "", phone: "", debt: "0", active: true }); setEditing(null); await load();
      toast.success("Сохранено");
    } catch (e: any) { toast.error(e?.message || "Ошибка сохранения"); }
  };

  return <div className="grid gap-6">
    <Card><CardHeader><CardTitle>Заказчики</CardTitle></CardHeader><CardContent>
      <form onSubmit={submit} className="grid gap-3 max-w-md">
        <div className="grid gap-1"><Label>Имя</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></div>
        <div className="grid gap-1"><Label>Телефон</Label><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></div>
        <div className="grid gap-1"><Label>Долг</Label><Input type="number" step="0.01" value={form.debt} onChange={(e)=>setForm({...form,debt:e.target.value})} /></div>
        <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(value)=>setForm({...form,active:value})} /><Label>Активен</Label></div>
        <Button type="submit">{editing ? "Сохранить" : "Добавить"}</Button>
      </form>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Список</CardTitle></CardHeader><CardContent className="space-y-2">
      {items.map((item) => <div key={item.id} className="border rounded p-2 flex items-center justify-between">
        <div>
          <div className="font-medium">{item.name || "—"}</div>
          <div className="text-xs text-muted-foreground">{item.phone || ""} · Долг: {item.debt ?? 0}</div>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={()=>{setEditing(item);setForm({name:item.name||"",phone:item.phone||"",debt:String(item.debt??0),active:item.active});}}>Редактировать</Button><Button variant="destructive" onClick={async()=>{if(window.confirm("Удалить заказчика?")){await apiDelete(`/api/workshop/customers/${item.id}`);await load();}}}>Удалить</Button></div>
      </div>)}
    </CardContent></Card>
  </div>;
}
