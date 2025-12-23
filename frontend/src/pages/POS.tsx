import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, ShoppingCart, Trash2, Plus, Minus, HandCoins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost } from "@/api/client";
import { AuthUser, getCurrentUser } from "@/lib/auth";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sale_price: number;
  barcode?: string | null;
  unit?: string;
  image_url?: string | null;
  photo?: string | null;
  available_qty: number;
  category?: string | null;
}

interface Client {
  id: number;
  name: string;
  phone?: string | null;
  total_debt: number;
}

type CartItem = {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  available_qty: number;
};

export default function POS() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtClientId, setDebtClientId] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtPaymentType, setDebtPaymentType] = useState<"cash" | "card">("cash");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const current = await getCurrentUser();
        if (current) {
          setUser(current);
        }
      } catch (error) {
        console.error(error);
        toast.error("Не удалось получить данные пользователя");
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const syncCartWithStock = useCallback((nextProducts: Product[]) => {
    setCart((prev) =>
      prev.map((item) => {
        const matched = nextProducts.find((p) => p.id === item.product_id);
        const available_qty = matched?.available_qty ?? item.available_qty;
        const safeQty = Math.min(item.quantity, available_qty);
        return {
          ...item,
          available_qty,
          quantity: safeQty,
          total: safeQty * item.price,
        };
      }),
    );
  }, []);

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const productsData = await apiGet<Product[]>(`/api/cashier/products`);
      setProducts(productsData);
      syncCartWithStock(productsData);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Не удалось загрузить товары");
    } finally {
      setIsLoadingProducts(false);
    }
  }, [syncCartWithStock]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    filterProducts();
  }, [selectedCategory, searchQuery, products]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [categoriesData, clientsData] = await Promise.all([
        apiGet<Category[]>("/api/categories"),
        apiGet<Client[]>("/api/clients"),
      ]);
      setCategories(categoriesData);
      setClients(clientsData);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить данные");
    }
  };

  const filterProducts = () => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter((p) => String(p.category) === selectedCategory);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(query) || p.barcode?.toLowerCase().includes(query),
      );
    }
    setFilteredProducts(filtered);
  };

  const addToCart = (product: Product) => {
    if (product.available_qty <= 0) {
      toast.error("Товар недоступен на складе магазина");
      return;
    }
    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      if (existingItem.quantity + 1 > product.available_qty) {
        toast.error(`Не хватает. Доступно: ${product.available_qty}`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.price,
              }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          price: product.sale_price,
          quantity: 1,
          total: product.sale_price,
          available_qty: product.available_qty,
        },
      ]);
    }
  };

  const updateQuantity = (product_id: number, delta: number) => {
    setCart(
      cart.map((item) => {
        if (item.product_id === product_id) {
          const desired = Math.max(1, item.quantity + delta);
          const newQty = Math.min(desired, item.available_qty);
          if (desired > item.available_qty) {
            toast.error(`Не хватает. Доступно: ${item.available_qty}`);
          }
          return { ...item, quantity: newQty, total: newQty * item.price };
        }
        return item;
      }),
    );
  };

  const updatePrice = (product_id: number, newPrice: number) => {
    setCart(
      cart.map((item) =>
        item.product_id === product_id
          ? { ...item, price: newPrice, total: item.quantity * newPrice }
          : item,
      ),
    );
  };

  const removeFromCart = (product_id: number) => {
    setCart(cart.filter((item) => item.product_id !== product_id));
  };

  const getTotalAmount = () => cart.reduce((sum, item) => sum + item.total, 0);
  const hasInsufficient = useMemo(() => cart.some((item) => item.quantity > item.available_qty), [cart]);

  const handlePayment = async () => {
    if (!user) {
      toast.error("Не удалось определить пользователя");
      return;
    }
    if (cart.length === 0) {
      toast.error("Корзина пуста");
      return;
    }
    const totalAmount = getTotalAmount();
    const cash = parseFloat(cashAmount) || 0;
    const card = parseFloat(cardAmount) || 0;
    const credit = parseFloat(creditAmount) || 0;
    const paidTotal = cash + card + credit;
    if (Math.abs(paidTotal - totalAmount) > 0.01) {
      toast.error("Сумма оплаты не совпадает с итогом");
      return;
    }
    if (credit > 0 && !selectedClient) {
      toast.error("Для продажи в долг выберите клиента");
      return;
    }
    for (const item of cart) {
      if (item.quantity > item.available_qty) {
        toast.error(`Не хватает. Доступно: ${item.available_qty}`);
        return;
      }
    }
    try {
      let paymentType = "cash";
      if (credit > 0) {
        paymentType = "credit";
      } else if (card > 0 && cash > 0) {
        paymentType = "mixed";
      } else if (card > 0) {
        paymentType = "kaspi";
      }
      await apiPost("/api/sales", {
        client_id: selectedClient ? Number(selectedClient) : null,
        paid_cash: cash,
        paid_card: card,
        paid_debt: credit,
        payment_type: paymentType,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          discount: 0,
        })),
      });
      toast.success("Продажа завершена успешно");
      setCart([]);
      setShowPaymentModal(false);
      setCashAmount("");
      setCardAmount("");
      setCreditAmount("");
      setSelectedClient("");
      loadProducts();
    } catch (error) {
      console.error(error);
      toast.error((error as any)?.message || "Ошибка при оформлении продажи");
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast.error("Укажите имя клиента");
      return;
    }
    try {
      const payload: { name: string; phone?: string } = { name: newClientName.trim() };
      if (newClientPhone.trim()) {
        const phone = newClientPhone.trim();
        const phoneRegex = /^[+0-9][0-9\s-]{5,}$/;
        if (!phoneRegex.test(phone)) {
          toast.error("Некорректный телефон");
          return;
        }
        payload.phone = phone;
      }
      const created = await apiPost<Client>("/api/clients", payload);
      setClients((prev) => [...prev, created]);
      setSelectedClient(String(created.id));
      setShowAddClientModal(false);
      setNewClientName("");
      setNewClientPhone("");
      toast.success("Клиент добавлен");
    } catch (error) {
      console.error(error);
      toast.error((error as any)?.message || "Не удалось создать клиента");
    }
  };

  const handleDebtPayment = async () => {
    if (!debtClientId) {
      toast.error("Выберите клиента");
      return;
    }
    const amountValue = parseFloat(debtAmount);
    if (!amountValue || amountValue <= 0) {
      toast.error("Введите сумму погашения");
      return;
    }
    try {
      await apiPost("/api/debts/pay", {
        client_id: Number(debtClientId),
        amount: amountValue,
        payment_type: debtPaymentType === "cash" ? "cash" : "card",
      });
      setClients((prev) =>
        prev.map((c) =>
          c.id === Number(debtClientId)
            ? { ...c, total_debt: Math.max(0, c.total_debt - amountValue) }
            : c,
        ),
      );
      toast.success("Долг погашен");
      setShowDebtModal(false);
      setDebtAmount("");
      setDebtClientId("");
    } catch (error) {
      console.error(error);
      toast.error((error as any)?.message || "Не удалось погасить долг");
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      <div className="flex-1 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или штрихкоду..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            onClick={() => setSelectedCategory(null)}
          >
            Все
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.name ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.name)}
            >
              {category.name}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="p-4 cursor-pointer hover:border-primary transition"
              onClick={() => addToCart(product)}
            >
              {(product.image_url || product.photo) && (
                <div className="mb-3 flex justify-center">
                  <img
                    src={product.image_url || product.photo || ""}
                    alt={product.name}
                    className="h-24 w-24 object-cover rounded"
                  />
                </div>
              )}
              <div className="font-semibold">{product.name}</div>
              <div className="text-sm text-muted-foreground">
                {product.sale_price.toFixed(2)} ₸ {product.unit ? `/ ${product.unit}` : ""}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Остаток: {product.available_qty}</div>
              {product.barcode && (
                <div className="text-xs text-muted-foreground mt-1">Штрихкод: {product.barcode}</div>
              )}
              {isLoadingProducts && <div className="text-xs text-muted-foreground mt-1">Обновление...</div>}
            </Card>
          ))}
        </div>
      </div>

      <Card className="w-full lg:w-96 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="text-xl font-bold">Корзина</h2>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setShowDebtModal(true)}>
            <HandCoins className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-2 overflow-auto mb-4">
        {cart.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">Корзина пуста</div>
        ) : (
          cart.map((item) => (
            <Card key={item.product_id} className="p-3">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="font-medium flex-1">{item.name}</div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFromCart(item.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateQuantity(item.product_id, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const capped = Math.min(val, item.available_qty);
                      if (val > item.available_qty) {
                        toast.error(`Не хватает. Доступно: ${item.available_qty}`);
                      }
                      updateQuantity(item.product_id, capped - item.quantity);
                    }}
                    className="w-16 text-center"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateQuantity(item.product_id, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">Доступно: {item.available_qty}</div>
                {item.quantity > item.available_qty && (
                  <div className="text-xs text-destructive font-medium">Не хватает на складе магазина</div>
                )}

                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={item.price}
                    onChange={(e) => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <div className="font-bold text-lg">{item.total.toFixed(2)} ₸</div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4 border-t pt-4">
          <div className="flex justify-between text-2xl font-bold">
            <span>Итого:</span>
            <span>{getTotalAmount().toFixed(2)} ₸</span>
          </div>
          {hasInsufficient && (
            <div className="text-sm text-destructive">Количество превышает остаток. Обновите позиции.</div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0 || hasInsufficient}
          >
            Оплата
          </Button>
        </div>
      </Card>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Оплата</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Филиал</Label>
              <div className="text-sm text-muted-foreground">Магазин</div>
            </div>

            {user && (
              <div>
                <Label>Продавец</Label>
                <div className="text-sm text-muted-foreground">{user.name}</div>
              </div>
            )}

            <div>
              <Label>Наличные</Label>
              <Input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Карта</Label>
              <Input
                type="number"
                value={cardAmount}
                onChange={(e) => setCardAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>В долг</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {parseFloat(creditAmount) > 0 && (
              <div>
                <Label>Клиент</Label>
                <div className="flex gap-2">
                  <Select value={selectedClient} onValueChange={setSelectedClient} className="flex-1">
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите клиента" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {client.name} {client.phone && `(${client.phone})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setShowAddClientModal(true)}>
                    + Добавить клиента
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between text-xl font-bold pt-4 border-t">
              <span>Итого:</span>
              <span>{getTotalAmount().toFixed(2)} ₸</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Отмена
            </Button>
            <Button onClick={handlePayment} disabled={hasInsufficient}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddClientModal} onOpenChange={setShowAddClientModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Имя *</Label>
              <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            </div>
            <div>
              <Label>Телефон</Label>
              <Input
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="+7 777 123-45-67"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddClientModal(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateClient}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDebtModal} onOpenChange={setShowDebtModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Погашение долга</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Клиент *</Label>
              <Select
                value={debtClientId}
                onValueChange={(val) => {
                  setDebtClientId(val);
                  const client = clients.find((c) => c.id === Number(val));
                  if (client) {
                    setDebtAmount(String(client.total_debt || ""));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name} • долг {client.total_debt.toFixed(2)} ₸
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Сумма</Label>
              <Input
                type="number"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Способ оплаты</Label>
              <Select value={debtPaymentType} onValueChange={(val) => setDebtPaymentType(val as "cash" | "card")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="card">Карта</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDebtModal(false)}>
              Отмена
            </Button>
            <Button onClick={handleDebtPayment}>Погасить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
