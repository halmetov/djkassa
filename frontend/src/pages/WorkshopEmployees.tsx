import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface Employee {
  id: number;
  first_name: string;
  last_name?: string;
  phone?: string;
  position?: string;
  active: boolean;
  total_salary: number;
}

export default function WorkshopEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [search, setSearch] = useState("");
  const [positionEdits, setPositionEdits] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      params.set("limit", "200");
      const data = await apiGet<Employee[]>(`/api/workshop/employees?${params.toString()}`);
      setEmployees(data);
      const positions: Record<number, string> = {};
      data.forEach((employee) => {
        positions[employee.id] = employee.position || "";
      });
      setPositionEdits(positions);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить сотрудников");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiPost("/api/workshop/employees", {
        first_name: firstName,
        last_name: lastName || undefined,
        phone: phone || undefined,
        position: position || undefined,
      });
      toast.success("Сотрудник создан");
      setFirstName("");
      setLastName("");
      setPhone("");
      setPosition("");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Не удалось создать сотрудника");
    }
  };

  const toggleActive = async (employee: Employee) => {
    try {
      await apiPut(`/api/workshop/employees/${employee.id}`, { active: !employee.active });
      load();
    } catch (error: any) {
      toast.error(error?.message || "Ошибка обновления");
    }
  };

  const remove = async (employee: Employee) => {
    try {
      await apiDelete(`/api/workshop/employees/${employee.id}`);
      load();
    } catch (error: any) {
      toast.error(error?.message || "Ошибка удаления");
    }
  };

  const savePosition = async (employee: Employee) => {
    try {
      await apiPut(`/api/workshop/employees/${employee.id}`, { position: positionEdits[employee.id] || "" });
      toast.success("Позиция обновлена");
      load();
    } catch (error: any) {
      toast.error(error?.message || "Ошибка обновления позиции");
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Добавить сотрудника цеха</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-2" onSubmit={create}>
            <Input placeholder="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input placeholder="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Позиция" value={position} onChange={(e) => setPosition(e.target.value)} />
            <Button type="submit">Создать</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Сотрудники</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Поиск по имени, телефону или позиции"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={load}>Поиск</Button>
          </div>
          {employees.map((employee) => (
            <div key={employee.id} className="flex items-center justify-between border p-2 rounded">
              <div>
                <div className="font-semibold">
                  {employee.first_name} {employee.last_name}
                </div>
                <div className="text-sm text-muted-foreground">{employee.phone}</div>
                <div className="text-sm text-muted-foreground">Позиция: {employee.position || "—"}</div>
                <div className="text-xs text-muted-foreground">Начислено: {employee.total_salary}</div>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Позиция"
                  value={positionEdits[employee.id] ?? ""}
                  onChange={(e) =>
                    setPositionEdits((prev) => ({
                      ...prev,
                      [employee.id]: e.target.value,
                    }))
                  }
                  className="w-32"
                />
                <Button variant="secondary" onClick={() => savePosition(employee)}>
                  Сохранить
                </Button>
                <Button variant="outline" onClick={() => toggleActive(employee)}>
                  {employee.active ? "Деактивировать" : "Активировать"}
                </Button>
                <Button variant="destructive" onClick={() => remove(employee)}>
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
