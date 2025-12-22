import { useState, useEffect } from "react";
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/api/client";
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

interface Product {
  id: number;
  name: string;
  category_id: number | null;
  unit: string;
  barcode: string | null;
  purchase_price: number;
  sale_price: number;
  wholesale_price: number;
  limit: number;
  quantity: number;
  image_url?: string | null;
  photo?: string | null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    unit: "шт",
    barcode: "",
    purchase_price: "0",
    sale_price: "0",
    wholesale_price: "0",
    limit: "0",
  });

  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await apiGet<Product[]>("/api/products");
      setProducts(data);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки товаров");
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiGet<{ id: number; name: string }[]>("/api/categories");
      setCategories(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error("Введите название товара");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      category_id: formData.category_id ? Number(formData.category_id) : null,
      unit: formData.unit,
      barcode: formData.barcode || null,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      sale_price: parseFloat(formData.sale_price) || 0,
      wholesale_price: parseFloat(formData.wholesale_price) || 0,
      limit: parseInt(formData.limit) || 0,
    };

    try {
      const product = await apiPost<Product>("/api/products", payload);

      if (newPhotoFile) {
        try {
          const photoData = new FormData();
          photoData.append("file", newPhotoFile);
          await apiUpload(`/api/products/${product.id}/photo`, photoData);
        } catch (error) {
          console.error(error);
          toast.error("Не удалось загрузить фото");
        }
      }

      toast.success("Товар добавлен");
    } catch (error) {
      console.error("Product creation failed", { error, payload });
      const message = error instanceof Error ? error.message : "Bad Request: проверь тело запроса";
      toast.error(message);
      return;
    }
    setFormData({
      name: "",
      category_id: "",
      unit: "шт",
      barcode: "",
      purchase_price: "0",
      sale_price: "0",
      wholesale_price: "0",
      limit: "0",
    });
    setNewPhotoFile(null);
    fetchProducts();
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditData({
      name: product.name,
      category_id: product.category_id ? String(product.category_id) : "",
      unit: product.unit,
      barcode: product.barcode || "",
      purchase_price: product.purchase_price.toString(),
      sale_price: product.sale_price.toString(),
      wholesale_price: product.wholesale_price.toString(),
      limit: (product.limit ?? 0).toString(),
    });
    setEditPhotoFile(null);
  };

  const handleSave = async (id: number) => {
    try {
      await apiPut(`/api/products/${id}`, {
        name: editData.name,
        category_id: editData.category_id ? Number(editData.category_id) : null,
        unit: editData.unit,
        barcode: editData.barcode || null,
        purchase_price: parseFloat(editData.purchase_price) || 0,
        sale_price: parseFloat(editData.sale_price) || 0,
        wholesale_price: parseFloat(editData.wholesale_price) || 0,
        limit: parseInt(editData.limit) || 0,
      });

      if (editPhotoFile) {
        try {
          const photoData = new FormData();
          photoData.append("file", editPhotoFile);
          await apiUpload(`/api/products/${id}/photo`, photoData);
        } catch (error) {
          console.error(error);
          toast.error("Не удалось загрузить фото");
        }
      }
      toast.success("Товар обновлен");
      setEditingId(null);
      setEditPhotoFile(null);
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка обновления");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/products/${id}`);
      toast.success("Товар удален");
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка удаления");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Товары</h1>
        <p className="text-muted-foreground">Управление товарами</p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Добавить товар</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <Label>Название</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Название товара"
            />
          </div>
          <div>
            <Label>Категория</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Без категории" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ед. измерения</Label>
            <Input
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="шт, кг, л"
            />
          </div>
          <div>
            <Label>Штрих-код</Label>
            <Input
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Штрих-код"
            />
          </div>
          <div>
            <Label>Фото (камера или устройство)</Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setNewPhotoFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <Label>Цена прихода</Label>
            <Input
              type="number"
              value={formData.purchase_price}
              onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
            />
          </div>
          <div>
            <Label>Цена продажи</Label>
            <Input
              type="number"
              value={formData.sale_price}
              onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
            />
          </div>
          <div>
            <Label>Цена оптом</Label>
            <Input
              type="number"
              value={formData.wholesale_price}
              onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
            />
          </div>
          <div>
            <Label>Лимит</Label>
            <Input
              type="number"
              value={formData.limit}
              onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={handleAdd}>Добавить товар</Button>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Фото</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Ед.изм</TableHead>
                <TableHead>Штрих-код</TableHead>
                <TableHead>Приход</TableHead>
                <TableHead>Продажа</TableHead>
                <TableHead>Оптом</TableHead>
                <TableHead>Лимит</TableHead>
                <TableHead>Кол-во</TableHead>
                <TableHead className="w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {products.map((product) => {
              const categoryName = categories.find((cat) => cat.id === product.category_id)?.name || "Без категории";
              return (
              <TableRow key={product.id}>
                  <TableCell>
                    {editingId === product.id ? (
                      <div className="space-y-2">
                        {(product.image_url || product.photo) && (
                          <img
                            src={product.image_url || product.photo || ""}
                            alt={product.name}
                            className="h-12 w-12 object-cover rounded"
                          />
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                        />
                      </div>
                    ) : product.image_url || product.photo ? (
                      <img
                        src={product.image_url || product.photo || ""}
                        alt={product.name}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">Нет фото</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      />
                    ) : (
                      product.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Select
                        value={editData.category_id}
                        onValueChange={(value) => setEditData({ ...editData, category_id: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      categoryName
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        value={editData.unit}
                        onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                        className="w-20"
                      />
                    ) : (
                      product.unit
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        value={editData.barcode}
                        onChange={(e) => setEditData({ ...editData, barcode: e.target.value })}
                      />
                    ) : (
                      product.barcode || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editData.purchase_price}
                        onChange={(e) => setEditData({ ...editData, purchase_price: e.target.value })}
                        className="w-24"
                      />
                    ) : (
                      product.purchase_price
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editData.sale_price}
                        onChange={(e) => setEditData({ ...editData, sale_price: e.target.value })}
                        className="w-24"
                      />
                    ) : (
                      product.sale_price
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editData.wholesale_price}
                        onChange={(e) => setEditData({ ...editData, wholesale_price: e.target.value })}
                        className="w-24"
                      />
                    ) : (
                      product.wholesale_price
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editData.limit}
                        onChange={(e) => setEditData({ ...editData, limit: e.target.value })}
                        className="w-20"
                      />
                    ) : (
                      product.limit ?? 0
                    )}
                  </TableCell>
                  <TableCell className={product.quantity <= (product.limit ?? 0) ? "text-destructive font-semibold" : ""}>
                    {product.quantity}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {editingId === product.id ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSave(product.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditPhotoFile(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
