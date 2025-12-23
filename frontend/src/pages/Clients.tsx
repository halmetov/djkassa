import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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

export default function Clients() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const [clients, setClients] = useState<{ id: number; name: string; phone?: string | null; total_debt: number }[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDebt, setNewDebt] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDebt, setEditDebt] = useState("");

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await apiGet<{ id: number; name: string; phone?: string | null; total_debt: number }[]>("/api/clients");
      setClients(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки клиентов");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;

    try {
      await apiPost("/api/clients", {
        name: newName.trim(),
        phone: newPhone.trim() || null,
        total_debt: newDebt ? parseFloat(newDebt) : 0,
      });
      toast.success("Клиент добавлен");
    } catch (error) {
      console.error(error);
      toast.error("Ошибка добавления клиента");
      return;
    }
    setNewName("");
    setNewPhone("");
    setNewDebt("");
    fetchClients();
  };

  const handleEdit = (client: { id: number; name: string; phone?: string | null; total_debt: number }) => {
    setEditingId(client.id);
    setEditName(client.name);
    setEditPhone(client.phone || "");
    setEditDebt(client.total_debt?.toString() || "0");
  };

  const handleSave = async (id: number) => {
    try {
      await apiPut(`/api/clients/${id}`, {
        name: editName,
        phone: editPhone || null,
        total_debt: editDebt ? parseFloat(editDebt) : 0,
      });
      toast.success("Клиент обновлен");
      setEditingId(null);
      fetchClients();
    } catch (error) {
      console.error(error);
      const status = (error as any)?.status;
      if (status === 403) {
        toast.error("Недостаточно прав");
      } else {
        toast.error("Ошибка обновления");
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/clients/${id}`);
      toast.success("Клиент удален");
      fetchClients();
    } catch (error) {
      console.error(error);
      const status = (error as any)?.status;
      if (status === 403) {
        toast.error("Недостаточно прав");
      } else {
        toast.error("Ошибка удаления");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Клиенты</h1>
        <p className="text-muted-foreground">Управление клиентами</p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Input
            placeholder="Имя клиента"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            placeholder="Телефон"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            placeholder="Долг"
            type="number"
            value={newDebt}
            onChange={(e) => setNewDebt(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} className="md:col-span-3">Добавить</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Долг</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  {editingId === client.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    client.name
                  )}
                </TableCell>
                <TableCell>
                  {editingId === client.id ? (
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Телефон"
                    />
                  ) : (
                    client.phone || "-"
                  )}
                </TableCell>
                <TableCell>
                  {editingId === client.id ? (
                    <Input
                      type="number"
                      value={editDebt}
                      onChange={(e) => setEditDebt(e.target.value)}
                      placeholder="Долг"
                    />
                  ) : (
                    <span className={client.total_debt > 0 ? "text-destructive" : ""}>
                      {client.total_debt || 0}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin && (
                    <div className="flex gap-2">
                      {editingId === client.id ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSave(client.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(client)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(client.id)}
                          >
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
      </Card>
    </div>
  );
}
