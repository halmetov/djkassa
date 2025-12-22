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

export default function Categories() {
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await apiGet<{ id: number; name: string }[]>("/api/categories");
      setCategories(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки категорий");
    }
  };

  const handleAdd = async () => {
    if (!newCategory.trim()) return;

    try {
      await apiPost("/api/categories", { name: newCategory.trim() });
      toast.success("Категория добавлена");
    } catch (error) {
      console.error(error);
      toast.error("Ошибка добавления категории");
      return;
    }
    setNewCategory("");
    fetchCategories();
  };

  const handleEdit = (id: number, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const handleSave = async (id: number) => {
    try {
      await apiPut(`/api/categories/${id}`, { name: editValue });
      toast.success("Категория обновлена");
      setEditingId(null);
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка обновления");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/categories/${id}`);
      toast.success("Категория удалена");
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка удаления");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Категории</h1>
        <p className="text-muted-foreground">Управление категориями товаров</p>
      </div>

      <Card className="p-6">
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Название категории"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd}>Добавить</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>
                  {editingId === cat.id ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    cat.name
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {editingId === cat.id ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSave(cat.id)}
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
                          onClick={() => handleEdit(cat.id, cat.name)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(cat.id)}
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
