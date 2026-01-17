import { useEffect, useMemo, useState } from "react";
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

type Counterparty = {
  id: number;
  name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  debt?: number | null;
};

export default function Counterparties() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [newName, setNewName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDebt, setNewDebt] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDebt, setEditDebt] = useState("");
  const totalDebt = useMemo(
    () => counterparties.reduce((sum, entry) => sum + (entry.debt || 0), 0),
    [counterparties],
  );

  useEffect(() => {
    if (!isAdmin) return;
    fetchCounterparties();
  }, [isAdmin]);

  const fetchCounterparties = async () => {
    try {
      const data = await apiGet<Counterparty[]>("/api/counterparties");
      setCounterparties(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки контрагентов");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() && !newCompanyName.trim()) return;

    try {
      await apiPost("/api/counterparties", {
        name: newName.trim() || null,
        company_name: newCompanyName.trim() || null,
        phone: newPhone.trim() || null,
        debt: newDebt ? parseFloat(newDebt) : null,
      });
      toast.success("Контрагент добавлен");
    } catch (error) {
      console.error(error);
      toast.error("Ошибка добавления контрагента");
      return;
    }
    setNewName("");
    setNewCompanyName("");
    setNewPhone("");
    setNewDebt("");
    fetchCounterparties();
  };

  const handleEdit = (counterparty: Counterparty) => {
    setEditingId(counterparty.id);
    setEditName(counterparty.name || "");
    setEditCompanyName(counterparty.company_name || "");
    setEditPhone(counterparty.phone || "");
    setEditDebt(counterparty.debt?.toString() || "");
  };

  const handleSave = async (id: number) => {
    try {
      await apiPut(`/api/counterparties/${id}`, {
        name: editName.trim() || null,
        company_name: editCompanyName.trim() || null,
        phone: editPhone.trim() || null,
        debt: editDebt ? parseFloat(editDebt) : null,
      });
      toast.success("Контрагент обновлен");
      setEditingId(null);
      fetchCounterparties();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка обновления");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/counterparties/${id}`);
      toast.success("Контрагент удален");
      fetchCounterparties();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка удаления");
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground">Раздел доступен только администраторам.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Контрагенты</h1>
          <p className="text-muted-foreground">Управление контрагентами</p>
        </div>
        <div className="text-lg font-semibold">
          Общий долг: {totalDebt.toFixed(2)} ₸
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Контактное лицо"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAdd()}
          />
          <Input
            placeholder="Фирма"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAdd()}
          />
          <Input
            placeholder="Телефон"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAdd()}
          />
          <Input
            placeholder="Долг"
            type="number"
            value={newDebt}
            onChange={(e) => setNewDebt(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} className="md:col-span-2 lg:col-span-4">
            Добавить
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Контакт</TableHead>
              <TableHead>Фирма</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Долг</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {counterparties.map((counterparty) => (
              <TableRow key={counterparty.id}>
                <TableCell>
                  {editingId === counterparty.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    counterparty.name || "-"
                  )}
                </TableCell>
                <TableCell>
                  {editingId === counterparty.id ? (
                    <Input
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      placeholder="Фирма"
                    />
                  ) : (
                    counterparty.company_name || "-"
                  )}
                </TableCell>
                <TableCell>
                  {editingId === counterparty.id ? (
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Телефон"
                    />
                  ) : (
                    counterparty.phone || "-"
                  )}
                </TableCell>
                <TableCell>
                  {editingId === counterparty.id ? (
                    <Input
                      type="number"
                      value={editDebt}
                      onChange={(e) => setEditDebt(e.target.value)}
                      placeholder="Долг"
                    />
                  ) : (
                    <span className={counterparty.debt && counterparty.debt > 0 ? "text-destructive" : ""}>
                      {counterparty.debt || 0}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {editingId === counterparty.id ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSave(counterparty.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(counterparty)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(counterparty.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
