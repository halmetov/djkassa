import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";

export default function Branches() {
  const [branches, setBranches] = useState<{ id: number; name: string; address?: string | null; active: boolean }[]>([]);
  const [newBranch, setNewBranch] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const data = await apiGet<{ id: number; name: string; address?: string | null; active: boolean }[]>("/api/branches");
      setBranches(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки филиалов");
    }
  };

  const handleAdd = async () => {
    if (!newBranch.trim()) return;

    try {
      await apiPost("/api/branches", {
        name: newBranch.trim(),
        address: newAddress.trim() || null,
        active: true,
      });
      toast.success("Филиал добавлен");
    } catch (error) {
      console.error(error);
      toast.error("Ошибка добавления филиала");
      return;
    }
    setNewBranch("");
    setNewAddress("");
    fetchBranches();
  };

  const handleEdit = (branch: { id: number; name: string; address?: string | null; active: boolean }) => {
    setEditingId(branch.id);
    setEditValue(branch.name);
    setEditAddress(branch.address || "");
    setEditActive(branch.active);
  };

  const handleSave = async (id: number) => {
    try {
      await apiPut(`/api/branches/${id}`, {
        name: editValue,
        address: editAddress || null,
        active: editActive,
      });
      toast.success("Филиал обновлен");
      setEditingId(null);
      fetchBranches();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка обновления");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/branches/${id}`);
      toast.success("Филиал удален");
      fetchBranches();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка удаления");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Филиалы</h1>
        <p className="text-muted-foreground">Управление филиалами складов</p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Input
            placeholder="Название филиала"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            placeholder="Адрес филиала"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} className="md:col-span-2">Добавить</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Адрес</TableHead>
              <TableHead>Активность</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  {editingId === branch.id ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    branch.name
                  )}
                </TableCell>
                <TableCell>
                  {editingId === branch.id ? (
                    <Input
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Адрес"
                    />
                  ) : (
                    branch.address || "-"
                  )}
                </TableCell>
                <TableCell>
                  {editingId === branch.id ? (
                    <Switch
                      checked={editActive}
                      onCheckedChange={setEditActive}
                    />
                  ) : (
                    <span className={branch.active ? "text-success" : "text-muted-foreground"}>
                      {branch.active ? "Активен" : "Неактивен"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {editingId === branch.id ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSave(branch.id)}
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
                          onClick={() => handleEdit(branch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(branch.id)}
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
