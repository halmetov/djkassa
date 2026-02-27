import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client";
import { useOutletContext } from "react-router-dom";

type Employee = {
  id: number;
  name: string;
  login: string;
  role: "admin" | "employee" | "production_manager" | "manager";
  active: boolean;
  branch_id: number | null;
};

type Branch = {
  id: number;
  name: string;
};

export default function Employees() {
  const { isAdmin, user } = useOutletContext<{ isAdmin: boolean; user: { branch_id: number | null } | null }>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    login: "",
    password: "",
    role: "employee" as Employee["role"],
    active: true,
    branch_id: null as number | null,
  });
  const [editData, setEditData] = useState({
    name: "",
    role: "employee" as Employee["role"],
    active: true,
    password: "",
    branch_id: null as number | null,
  });

  useEffect(() => {
    fetchEmployees();
    fetchBranches();
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await apiGet<Employee[]>("/api/users");
      setEmployees(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Ошибка загрузки сотрудников");
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await apiGet<Branch[]>("/api/branches");
      setBranches(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Не удалось загрузить список филиалов");
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.login.trim() || !formData.password.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    try {
      await apiPost("/api/users", {
        name: formData.name.trim(),
        login: formData.login.trim(),
        password: formData.password,
        role: formData.role,
        active: formData.active,
        branch_id: formData.branch_id,
      });
      toast.success("Сотрудник добавлен");
      setFormData({ name: "", login: "", password: "", role: "employee", active: true, branch_id: null });
      fetchEmployees();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Ошибка добавления сотрудника");
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setEditData({
      name: employee.name,
      role: employee.role,
      active: employee.active,
      password: "",
      branch_id: employee.branch_id,
    });
  };

  const handleSave = async (id: number) => {
    try {
      await apiPut(`/api/users/${id}`, {
        name: editData.name,
        role: editData.role,
        active: editData.active,
        password: editData.password || undefined,
        branch_id: editData.branch_id,
      });
      toast.success("Сотрудник обновлен");
      setEditingId(null);
      fetchEmployees();
    } catch (error: any) {
      console.error(error);
      const status = error?.status;
      if (status === 403) {
        toast.error("Недостаточно прав");
      } else {
        toast.error(error?.message || "Ошибка обновления");
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/users/${id}`);
      toast.success("Сотрудник удален");
      fetchEmployees();
    } catch (error: any) {
      console.error(error);
      const status = error?.status;
      if (status === 403) {
        toast.error("Недостаточно прав");
      } else {
        toast.error(error?.message || "Ошибка удаления");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Сотрудники</h1>
        <p className="text-muted-foreground">Управление пользователями системы</p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Добавить сотрудника</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <Label>Имя</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Имя сотрудника"
            />
          </div>
          <div>
            <Label>Логин</Label>
            <Input
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              placeholder="Логин"
            />
          </div>
          <div>
            <Label>Пароль</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Пароль"
            />
          </div>
          <div>
            <Label>Роль</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Администратор</SelectItem>
                <SelectItem value="employee">Продавец</SelectItem>
                <SelectItem value="production_manager">Менеджер производства (старый)</SelectItem>
                <SelectItem value="manager">Менеджер производства</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Филиал</Label>
            <Select
              value={formData.branch_id !== null ? String(formData.branch_id) : "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, branch_id: value === "none" ? null : Number(value) })
              }
              disabled={!isAdmin && Boolean(user?.branch_id)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите филиал" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без филиала</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Активен</Label>
            <Switch
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              disabled={!isAdmin}
            />
          </div>
        </div>
        <Button onClick={handleAdd}>Добавить</Button>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Логин</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Филиал</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-[120px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    {editingId === employee.id ? (
                      <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                    ) : (
                      employee.name
                    )}
                  </TableCell>
                  <TableCell>{employee.login}</TableCell>
                  <TableCell>
                    {editingId === employee.id ? (
                    <Select
                      value={editData.role}
                      onValueChange={(value) => setEditData({ ...editData, role: value })}
                      disabled={!isAdmin}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="employee">Продавец</SelectItem>
                        <SelectItem value="production_manager">Менеджер производства (старый)</SelectItem>
                <SelectItem value="manager">Менеджер производства</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    employee.role === "admin"
                      ? "Администратор"
                      : employee.role === "manager" || employee.role === "production_manager"
                        ? "Менеджер производства"
                        : "Продавец"
                  )}
                  </TableCell>
                  <TableCell>
                    {editingId === employee.id ? (
                      <Select
                        value={editData.branch_id !== null ? String(editData.branch_id) : "none"}
                        onValueChange={(value) =>
                          setEditData({ ...editData, branch_id: value === "none" ? null : Number(value) })
                        }
                        disabled={!isAdmin && Boolean(user?.branch_id)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Без филиала</SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={String(branch.id)}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      branches.find((branch) => branch.id === employee.branch_id)?.name || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === employee.id ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editData.active}
                          onCheckedChange={(checked) => setEditData({ ...editData, active: checked })}
                          disabled={!isAdmin}
                        />
                        <Input
                          type="password"
                          placeholder="Новый пароль"
                          value={editData.password}
                          onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                        />
                      </div>
                    ) : (
                      <span className={employee.active ? "text-success" : "text-muted-foreground"}>
                        {employee.active ? "Активен" : "Заблокирован"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin && (
                      <div className="flex gap-2">
                        {editingId === employee.id ? (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => handleSave(employee.id)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(employee)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(employee.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
