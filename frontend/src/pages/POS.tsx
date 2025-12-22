import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
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
  category_id: number | null;
  sale_price: number;
  barcode?: string | null;
  unit: string;
  image_url?: string | null;
  photo?: string | null;
}

interface Branch {
  id: number;
  name: string;
  active: boolean;
}

interface Client {
  id: number;
  name: string;
  phone?: string | null;
}

interface Seller {
  id: number;
  name: string;
  role: string;
  branch_id: number | null;
  active: boolean;
}

type CartItem = {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
};

export default function POS() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedClient, setSelectedClient] = useState("");

  const isEmployee = user?.role === "employee";

  useEffect(() => {
    const loadUser = async () => {
      try {
        const current = await getCurrentUser();
        if (current) {
          setUser(current);
          setSelectedSeller(String(current.id));
          if (current.branch_id) {
            setSelectedBranch(String(current.branch_id));
          }
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

  useEffect(() => {
    const loadProducts = async () => {
      if (!user) return;
      const branchId = user.role === "employee" ? user.branch_id : selectedBranch ? Number(selectedBranch) : null;
      if (!branchId) {
        setProducts([]);
        setFilteredProducts([]);
        if (user.role === "employee") {
          toast.error("Сотрудник не привязан к филиалу");
        }
        return;
      }
      try {
        const productsData = await apiGet<Product[]>(`/api/products?branch_id=${branchId}`);
        setProducts(productsData);
      } catch (error) {
        console.error(error);
        toast.error("Не удалось загрузить товары");
      }
    };

    loadProducts();
  }, [selectedBranch, user]);

  useEffect(() => {
    filterProducts();
  }, [selectedCategory, searchQuery, products]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [categoriesData, branchesData, clientsData] = await Promise.all([
        apiGet<Category[]>("/api/categories"),
        apiGet<Branch[]>("/api/branches"),
        apiGet<Client[]>("/api/clients"),
      ]);
      setCategories(categoriesData);
      const activeBranches = branchesData.filter((branch) => branch.active);
      setBranches(activeBranches);
      setSelectedBranch((prev) => {
        if (prev) return prev;
        const preferredBranch = user.branch_id ?? activeBranches[0]?.id;
        return preferredBranch ? String(preferredBranch) : "";
      });
      setClients(clientsData);

      if (user.role === "admin") {
        const usersData = await apiGet<Seller[]>("/api/users");
        const activeSellers = usersData.filter((u) => u.active);
        setSellers(activeSellers);
        setSelectedSeller((prev) => {
          if (prev) return prev;
          const fallback =
            activeSellers.find((seller) => seller.id === user.id)?.id || activeSellers[0]?.id;
          return fallback ? String(fallback) : "";
        });
      } else {
        const selfSeller: Seller = {
          id: user.id,
          name: user.name,
          role: user.role,
          branch_id: user.branch_id,
          active: user.active,
        };
        setSellers([selfSeller]);
        setSelectedSeller(String(user.id));
      }
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить данные");
    }
  };

  const filterProducts = () => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter((p) => String(p.category_id) === selectedCategory);
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
    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
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
        },
      ]);
    }
  };

  const updateQuantity = (product_id: number, delta: number) => {
    setCart(
      cart.map((item) => {
        if (item.product_id === product_id) {
          const newQty = Math.max(1, item.quantity + delta);
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

  const handlePayment = async () => {
    if (!user) {
      toast.error("Не удалось определить пользователя");
      return;
    }
    const branchId = isEmployee ? user.branch_id : selectedBranch ? Number(selectedBranch) : null;
    const sellerId = isEmployee ? user.id : selectedSeller ? Number(selectedSeller) : user.id;
    if (!branchId) {
      toast.error("Выберите филиал");
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
      toast.error("Выберите клиента для кредита");
      return;
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
        branch_id: branchId,
        seller_id: sellerId,
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
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при оформлении продажи");
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
              variant={selectedCategory === String(category.id) ? "default" : "outline"}
              onClick={() => setSelectedCategory(String(category.id))}
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
                {product.sale_price.toFixed(2)} ₸ / {product.unit}
              </div>
              {product.barcode && (
                <div className="text-xs text-muted-foreground mt-1">Штрихкод: {product.barcode}</div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <Card className="w-full lg:w-96 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="text-xl font-bold">Корзина</h2>
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
                        updateQuantity(item.product_id, val - item.quantity);
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

          <Button
            className="w-full"
            size="lg"
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
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
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите филиал" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={String(branch.id)}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Продавец</Label>
              <Select
                value={selectedSeller}
                onValueChange={setSelectedSeller}
                disabled={isEmployee || sellers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите продавца" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={String(seller.id)}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                <Select value={selectedClient} onValueChange={setSelectedClient}>
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
            <Button onClick={handlePayment}>Подтвердить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
