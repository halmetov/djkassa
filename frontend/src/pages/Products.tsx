import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Eye } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Product {
  id: number;
  name: string;
  category_id: number | null;
  unit: string;
  barcode: string | null;
  purchase_price: number;
  sale_price: number;
  wholesale_price: number;
  red_price?: number | null;
  limit: number;
  quantity: number;
  image_url?: string | null;
  photo?: string | null;
  rating?: number | null;
}

export default function Products() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    unit: "шт",
    barcode: "",
    purchase_price: "0",
    sale_price: "0",
    wholesale_price: "0",
    red_price: "",
    limit: "0",
    rating: "0",
  });

  const [editData, setEditData] = useState<any>({ rating: "0", red_price: "" });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await apiGet<Product[]>("/api/products");
      setProducts(data);
      setSelectedProduct((prev) => (prev ? data.find((p) => p.id === prev.id) || prev : prev));
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
      red_price: formData.red_price.trim() ? parseFloat(formData.red_price) : null,
      limit: parseInt(formData.limit) || 0,
      rating: Math.max(0, parseInt(formData.rating, 10) || 0),
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
      red_price: "",
      limit: "0",
      rating: "0",
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
      red_price: product.red_price !== null && product.red_price !== undefined ? product.red_price.toString() : "",
      limit: (product.limit ?? 0).toString(),
      rating: (product.rating ?? 0).toString(),
    });
    setEditPhotoFile(null);
    setSelectedProduct(product);
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
        red_price: editData.red_price?.trim() ? parseFloat(editData.red_price) : null,
        limit: parseInt(editData.limit) || 0,
        rating: Math.max(0, parseInt(editData.rating, 10) || 0),
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
      setSelectedProduct((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              name: editData.name,
              category_id: editData.category_id ? Number(editData.category_id) : null,
              unit: editData.unit,
              barcode: editData.barcode || null,
              purchase_price: parseFloat(editData.purchase_price) || 0,
              sale_price: parseFloat(editData.sale_price) || 0,
              wholesale_price: parseFloat(editData.wholesale_price) || 0,
              red_price: editData.red_price?.trim() ? parseFloat(editData.red_price) : null,
              limit: parseInt(editData.limit) || 0,
              rating: Math.max(0, parseInt(editData.rating, 10) || 0),
            }
          : prev,
      );
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
    if (!window.confirm("Удалить товар?")) return;
    try {
      await apiDelete(`/api/products/${id}`);
      toast.success("Товар удален");
      fetchProducts();
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
        setShowDetails(false);
      }
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

  const getCategoryName = (id: number | null) =>
    categories.find((cat) => cat.id === id)?.name || "Без категории";

  const openDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetails(true);
    setEditingId(null);
    setEditPhotoFile(null);
  };

  const startEditInModal = (product: Product) => {
    openDetails(product);
    handleEdit(product);
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
            <Label>Красная цена</Label>
            <Input
              type="number"
              value={formData.red_price}
              onChange={(e) => setFormData({ ...formData, red_price: e.target.value })}
              placeholder="Необязательно"
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
          <div>
            <Label>Рейтинг</Label>
            <Input
              type="number"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              min={0}
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
                <TableHead>Кол-во</TableHead>
                <TableHead className="w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {products.map((product) => {
              const categoryName = getCategoryName(product.category_id);
              return (
              <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url || product.photo ? (
                      <img
                        src={product.image_url || product.photo || ""}
                        alt={product.name}
                        className="h-12 w-12 object-contain rounded bg-muted cursor-pointer"
                        onClick={() =>
                          setPreviewImage({
                            src: product.image_url || product.photo || "",
                            alt: product.name,
                          })
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">Нет фото</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{categoryName}</div>
                    </div>
                  </TableCell>
                  <TableCell className={product.quantity <= (product.limit ?? 0) ? "text-destructive font-semibold" : ""}>
                    {product.quantity}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openDetails(product)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog
        open={showDetails}
        onOpenChange={(open) => {
          setShowDetails(open);
          if (!open) {
            setEditingId(null);
            setEditPhotoFile(null);
            setPreviewImage(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Подробнее о товаре</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="w-full sm:w-40 flex-shrink-0">
                  {editingId === selectedProduct.id ? (
                    <div className="space-y-2">
                      {(selectedProduct.image_url || selectedProduct.photo) && (
                        <img
                          src={selectedProduct.image_url || selectedProduct.photo || ""}
                          alt={selectedProduct.name}
                          className="h-32 w-full object-contain rounded bg-muted"
                          onClick={() =>
                            setPreviewImage({
                              src: selectedProduct.image_url || selectedProduct.photo || "",
                              alt: selectedProduct.name,
                            })
                          }
                        />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  ) : selectedProduct.image_url || selectedProduct.photo ? (
                    <img
                      src={selectedProduct.image_url || selectedProduct.photo || ""}
                      alt={selectedProduct.name}
                      className="h-32 w-full object-contain rounded bg-muted"
                      onClick={() =>
                        setPreviewImage({
                          src: selectedProduct.image_url || selectedProduct.photo || "",
                          alt: selectedProduct.name,
                        })
                      }
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm">Нет фото</div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm flex-1">
                  <div><span className="text-muted-foreground">Название:</span> {selectedProduct.name}</div>
                  <div>
                    <span className="text-muted-foreground">Категория:</span> {getCategoryName(selectedProduct.category_id)}
                  </div>
                  <div><span className="text-muted-foreground">Штрих-код:</span> {selectedProduct.barcode || "-"}</div>
                  <div><span className="text-muted-foreground">Ед. изм:</span> {selectedProduct.unit}</div>
                  <div><span className="text-muted-foreground">Цена прихода:</span> {selectedProduct.purchase_price} ₸</div>
                  <div><span className="text-muted-foreground">Цена продажи:</span> {selectedProduct.sale_price} ₸</div>
                  <div><span className="text-muted-foreground">Цена оптом:</span> {selectedProduct.wholesale_price} ₸</div>
                  <div>
                    <span className="text-muted-foreground">Красная цена:</span>{" "}
                    {selectedProduct.red_price !== null && selectedProduct.red_price !== undefined
                      ? `${selectedProduct.red_price.toFixed(2)} ₸`
                      : "-"}
                  </div>
                  <div><span className="text-muted-foreground">Лимит:</span> {selectedProduct.limit ?? 0}</div>
                  <div><span className="text-muted-foreground">Рейтинг:</span> {selectedProduct.rating ?? 0}</div>
                  <div><span className="text-muted-foreground">Доступно:</span> {selectedProduct.quantity}</div>
                </div>
              </div>

              {editingId === selectedProduct.id ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Название</Label>
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Категория</Label>
                    <Select
                      value={editData.category_id}
                      onValueChange={(value) => setEditData({ ...editData, category_id: value })}
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
                      value={editData.unit}
                      onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Штрих-код</Label>
                    <Input
                      value={editData.barcode}
                      onChange={(e) => setEditData({ ...editData, barcode: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Цена прихода</Label>
                    <Input
                      type="number"
                      value={editData.purchase_price}
                      onChange={(e) => setEditData({ ...editData, purchase_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Цена продажи</Label>
                    <Input
                      type="number"
                      value={editData.sale_price}
                      onChange={(e) => setEditData({ ...editData, sale_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Цена оптом</Label>
                    <Input
                      type="number"
                      value={editData.wholesale_price}
                      onChange={(e) => setEditData({ ...editData, wholesale_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Красная цена</Label>
                    <Input
                      type="number"
                      value={editData.red_price}
                      onChange={(e) => setEditData({ ...editData, red_price: e.target.value })}
                      placeholder="Необязательно"
                    />
                  </div>
                  <div>
                    <Label>Лимит</Label>
                    <Input
                      type="number"
                      value={editData.limit}
                      onChange={(e) => setEditData({ ...editData, limit: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Рейтинг</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editData.rating}
                      onChange={(e) => setEditData({ ...editData, rating: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Последнее обновление: данные товара отображены полностью. Нажмите «Редактировать», чтобы внести изменения.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
            {isAdmin && selectedProduct && (
              <div className="flex gap-2">
                {editingId === selectedProduct.id ? (
                  <>
                    <Button onClick={() => handleSave(selectedProduct.id)}>
                      <Check className="h-4 w-4 mr-2" /> Сохранить
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setEditPhotoFile(null);
                      }}
                    >
                      <X className="h-4 w-4 mr-2" /> Отмена
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => startEditInModal(selectedProduct)}>
                      <Pencil className="h-4 w-4 mr-2" /> Изменить
                    </Button>
                    <Button variant="destructive" onClick={() => handleDelete(selectedProduct.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Удалить
                    </Button>
                  </>
                )}
              </div>
            )}
            <Button variant="secondary" onClick={() => setShowDetails(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.alt || "Фото товара"}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex items-center justify-center">
              <img
                src={previewImage.src}
                alt={previewImage.alt}
                className="max-h-[70vh] w-full object-contain rounded bg-muted"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
