import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Search, ShoppingCart, Trash2, Plus, Minus, HandCoins, Package } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { CART_TTL_MS, loadStoredCart, saveCartState, clearCartState } from "@/lib/cartStorage";

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
  rating?: number | null;
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
  quantityInput?: string;
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
  const [lastCartUpdate, setLastCartUpdate] = useState<number | null>(null);
  const [hasHydratedCart, setHasHydratedCart] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "cart">("products");

  const MIN_QUANTITY = 1;
  const isMobile = useIsMobile();
  const cartBadgeCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const normalizeRating = useCallback((value?: number | null) => value ?? 0, []);

  const sortProductsByRating = useCallback(
    (list: Product[]) =>
      [...list].sort((a, b) => {
        const ratingA = normalizeRating(a.rating);
        const ratingB = normalizeRating(b.rating);
        const groupA = ratingA === 0 ? 0 : 1;
        const groupB = ratingB === 0 ? 0 : 1;

        if (groupA !== groupB) return groupA - groupB;
        if (ratingA !== ratingB) return ratingA - ratingB;
        return a.name.localeCompare(b.name);
      }),
    [normalizeRating],
  );

  const parseQuantityInput = useCallback((value?: string | number) => {
    if (typeof value === "number") return Math.max(0, value);
    if (value === undefined) return null;
    const sanitized = value.replace(/[^0-9]/g, "");
    if (sanitized === "") return null;
    return Math.max(0, parseInt(sanitized, 10));
  }, []);

  const formatQuantityInput = useCallback((value: number) => String(value), []);

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
      const stored = loadStoredCart<CartItem>(user.id);
      setCart(stored?.cart ?? []);
      setLastCartUpdate(stored?.updatedAt ?? null);
      setHasHydratedCart(true);
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (!user || !hasHydratedCart) return;
    saveCartState<CartItem>(user.id, cart);
    setLastCartUpdate(Date.now());
  }, [cart, user, hasHydratedCart]);

  useEffect(() => {
    if (!lastCartUpdate) return;
    const checker = setInterval(() => {
      if (lastCartUpdate && Date.now() - lastCartUpdate > CART_TTL_MS) {
        setCart([]);
        setLastCartUpdate(null);
        if (user) {
          saveCartState<CartItem>(user.id, []);
        } else {
          clearCartState();
        }
      }
    }, 30_000);
    return () => clearInterval(checker);
  }, [lastCartUpdate, user]);

  const syncCartWithStock = useCallback(
    (nextProducts: Product[]) => {
      setCart((prev) =>
        prev.map((item) => {
          const matched = nextProducts.find((p) => p.id === item.product_id);
          const available_qty = matched?.available_qty ?? item.available_qty;
          const parsedInput = parseQuantityInput(item.quantityInput ?? item.quantity);
          const numeric = parsedInput ?? item.quantity ?? MIN_QUANTITY;
          const safeQty = Math.max(MIN_QUANTITY, Math.min(numeric, available_qty));
          return {
            ...item,
            available_qty,
            quantity: safeQty,
            quantityInput: item.quantityInput === "" ? "" : formatQuantityInput(safeQty),
            total: safeQty * item.price,
          };
        }),
      );
    },
    [formatQuantityInput, parseQuantityInput],
  );

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const productsData = await apiGet<Product[]>(`/api/cashier/products`);
      const normalized = productsData.map((product) => ({
        ...product,
        rating: normalizeRating(product.rating),
      }));
      const sorted = sortProductsByRating(normalized);
      setProducts(sorted);
      syncCartWithStock(sorted);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Не удалось загрузить товары");
    } finally {
      setIsLoadingProducts(false);
    }
  }, [normalizeRating, sortProductsByRating, syncCartWithStock]);

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
    setFilteredProducts(sortProductsByRating(filtered));
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
                quantity: Math.min(item.quantity + 1, product.available_qty),
                quantityInput: formatQuantityInput(Math.min(item.quantity + 1, product.available_qty)),
                total: Math.min(item.quantity + 1, product.available_qty) * item.price,
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
          quantity: MIN_QUANTITY,
          quantityInput: String(MIN_QUANTITY),
          total: MIN_QUANTITY * product.sale_price,
          available_qty: product.available_qty,
        },
      ]);
    }
  };

  const updateQuantity = (product_id: number, delta: number) => {
    setCart(
      cart.map((item) => {
        if (item.product_id === product_id) {
          const desired = item.quantity + delta;
          const normalized = Math.max(MIN_QUANTITY, desired);
          const newQty = Math.min(normalized, item.available_qty);
          if (normalized > item.available_qty) {
            toast.error(`Не хватает. Доступно: ${item.available_qty}`);
          }
          return {
            ...item,
            quantity: newQty,
            quantityInput: formatQuantityInput(newQty),
            total: newQty * item.price,
          };
        }
        return item;
      }),
    );
  };

  const handleManualQuantityChange = (product_id: number, raw: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== product_id) return item;
        const sanitized = raw.replace(/[^0-9]/g, "");
        const parsed = sanitized === "" ? null : parseInt(sanitized, 10);
        const safeQty = parsed === null ? 0 : Math.min(parsed, item.available_qty);
        return {
          ...item,
          quantity: safeQty,
          quantityInput: raw === "" ? "" : sanitized,
          total: safeQty * item.price,
        };
      }),
    );
  };

  const handleQuantityBlur = (product_id: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== product_id) return item;
        const parsed = parseQuantityInput(item.quantityInput ?? item.quantity);
        const normalized = parsed === null || parsed < MIN_QUANTITY ? MIN_QUANTITY : parsed;
        const clamped = Math.min(normalized, item.available_qty);
        return {
          ...item,
          quantity: clamped,
          quantityInput: formatQuantityInput(clamped),
          total: clamped * item.price,
        };
      }),
    );
  };

  const handleQuantityFocus = (product_id: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== product_id) return item;
        return { ...item, quantityInput: item.quantityInput === "0" ? "" : item.quantityInput };
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

  const decreaseFromCard = (product_id: number) => {
    const item = cart.find((cartItem) => cartItem.product_id === product_id);
    if (!item) return;
    if (item.quantity <= MIN_QUANTITY) {
      removeFromCart(product_id);
      return;
    }
    updateQuantity(product_id, -1);
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
    if (cart.some((item) => item.quantity <= 0)) {
      toast.error("Количество товара должно быть больше 0");
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
    <div className="h-full flex flex-col lg:flex-row gap-4 pb-20 lg:pb-0">
      <div className={cn("flex-1 space-y-4", isMobile && activeTab !== "products" ? "hidden" : "") }>
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
          {filteredProducts.map((product) => {
            const cartItem = cart.find((item) => item.product_id === product.id);
            const quantity = cartItem?.quantity ?? 0;

            return (
              <Card
                key={product.id}
                className="overflow-hidden hover:border-primary transition"
              >
                <div className="relative bg-muted/40">
                  {product.image_url || product.photo ? (
                    <img
                      src={product.image_url || product.photo || ""}
                      alt={product.name}
                      className="h-36 w-full object-contain object-center bg-white"
                    />
                  ) : (
                    <div className="h-36 w-full flex items-center justify-center text-muted-foreground text-sm">
                      Нет фото
                    </div>
                  )}

                  <div className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-1 text-xs font-semibold shadow">
                    {product.available_qty}
                  </div>

                  {product.barcode && (
                    <div className="absolute top-2 right-2 rounded bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow">
                      {product.barcode}
                    </div>
                  )}
                </div>

                <div className="p-3 flex items-end gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div
                      className="font-semibold leading-tight overflow-hidden"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {product.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {product.sale_price.toFixed(2)} ₸ {product.unit ? `/ ${product.unit}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
                    {quantity > 0 ? (
                      <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1 shadow-sm">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation();
                            decreaseFromCard(product.id);
                          }}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="min-w-[28px] text-center text-sm font-semibold">{quantity}</div>
                        <Button
                          size="icon"
                          variant="default"
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation();
                            addToCart(product);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={(event) => {
                          event.stopPropagation();
                          addToCart(product);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card
        className={cn(
          "w-full lg:w-96 p-4 flex flex-col",
          isMobile && activeTab !== "cart" ? "hidden" : "",
        )}
      >
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
                    inputMode="numeric"
                    value={item.quantityInput ?? String(item.quantity ?? 0)}
                    onChange={(e) => handleManualQuantityChange(item.product_id, e.target.value)}
                    onFocus={() => handleQuantityFocus(item.product_id)}
                    onBlur={() => handleQuantityBlur(item.product_id)}
                    className={cn(
                      "w-16 text-center",
                      item.quantity > item.available_qty
                        ? "border-destructive focus-visible:ring-destructive"
                        : undefined,
                    )}
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

      {isMobile && (
        <div
          className="fixed bottom-0 left-0 right-0 border-t bg-card grid grid-cols-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
        >
          <Button
            variant={activeTab === "products" ? "default" : "ghost"}
            className="rounded-none"
            onClick={() => setActiveTab("products")}
          >
            <Package className="h-4 w-4 mr-2" /> Товары
          </Button>
          <Button
            variant={activeTab === "cart" ? "default" : "ghost"}
            className="rounded-none"
            onClick={() => setActiveTab("cart")}
          >
            <ShoppingCart className="h-4 w-4 mr-2" /> Корзина
            {cartBadgeCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-destructive px-2 text-xs font-semibold text-destructive-foreground">
                {cartBadgeCount}
              </span>
            )}
          </Button>
        </div>
      )}

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
