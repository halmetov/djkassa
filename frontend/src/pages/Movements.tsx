import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/api/client";
import { toast } from "sonner";
import { AuthUser, getCurrentUser } from "@/lib/auth";

type Branch = { id: number; name: string; active: boolean };
type StockItem = { product_id: number; product: string; quantity: number };
type MovementItem = {
  product_id: number;
  quantity: number;
  quantityInput?: string;
  available: number;
  product_name?: string;
};
type MovementSummary = {
  id: number;
  from_branch_id: number;
  to_branch_id: number;
  status: string;
  comment?: string | null;
  reason?: string | null;
  created_at: string;
  processed_at?: string | null;
  created_by_id?: number | null;
  processed_by_id?: number | null;
  from_branch_name?: string | null;
  to_branch_name?: string | null;
  created_by_name?: string | null;
  processed_by_name?: string | null;
  items: { id: number; product_id: number; product_name?: string | null; quantity: number }[];
};
type MovementDetail = MovementSummary;

const statusLabels: Record<string, string> = {
  waiting: "Ожидание",
  done: "Завершено",
  rejected: "Отклонено",
};

const MIN_MOVEMENT_QTY = 1;

export default function Movements() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fromBranch, setFromBranch] = useState<string>("");
  const [toBranch, setToBranch] = useState<string>("");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [items, setItems] = useState<MovementItem[]>([]);
  const [comment, setComment] = useState("");
  const [incoming, setIncoming] = useState<MovementSummary[]>([]);
  const [history, setHistory] = useState<MovementSummary[]>([]);
  const [historyStatus, setHistoryStatus] = useState<string>("all");
  const [selectedMovement, setSelectedMovement] = useState<MovementDetail | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const current = await getCurrentUser();
        if (current) {
          setUser(current);
        }
        const branchesData = await apiGet<Branch[]>("/api/branches");
        const activeBranches = branchesData.filter((b) => b.active);
        setBranches(activeBranches);
        if (activeBranches.length > 0) {
          if (current?.role === "employee") {
            setFromBranch("");
            setToBranch("");
          } else {
            setFromBranch(String(activeBranches[0].id));
            const second = activeBranches.find((b) => b.id !== activeBranches[0].id);
            setToBranch(second ? String(second.id) : "");
          }
        } else {
          setFromBranch("");
          setToBranch("");
        }
      } catch (error) {
        console.error(error);
        toast.error("Не удалось загрузить данные филиалов");
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (fromBranch) {
      loadStock();
    } else {
      setStock([]);
    }
  }, [fromBranch]);

  useEffect(() => {
    loadIncoming();
    loadHistory();
  }, [user, historyStatus]);

  useEffect(() => {
    if (!fromBranch) {
      setToBranch("");
      return;
    }
    if (toBranch && toBranch === fromBranch) {
      const next = branches.find((b) => String(b.id) !== fromBranch);
      setToBranch(next ? String(next.id) : "");
    }
  }, [fromBranch, toBranch, branches]);

  const loadStock = async () => {
    try {
      const data = await apiGet<StockItem[]>(`/api/branches/${fromBranch}/stock`);
      setStock(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить остатки склада");
    }
  };

  const loadIncoming = async () => {
    try {
      const params = new URLSearchParams();
      params.set("status", "waiting");
      const query = params.toString();
      const data = await apiGet<MovementSummary[]>(`/api/movements?${query}`);
      setIncoming(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить входящие перемещения");
    }
  };

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (historyStatus !== "all") {
        params.set("status", historyStatus);
      }
      const query = params.toString();
      const data = await apiGet<MovementSummary[]>(`/api/movements${query ? `?${query}` : ""}`);
      setHistory(data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить историю");
    }
  };

  const stockOptions = useMemo(() => stock.map((s) => ({ value: s.product_id, label: s.product, available: s.quantity })), [stock]);
  const toBranchOptions = useMemo(
    () =>
      branches.filter((b) => (!fromBranch ? true : b.id !== Number(fromBranch))),
    [branches, fromBranch]
  );

  const handleAddItemRow = () => {
    if (!fromBranch) {
      toast.error("Выберите филиал-отправитель");
      return;
    }
    setItems((prev) => [
      ...prev,
      { product_id: 0, quantity: MIN_MOVEMENT_QTY, quantityInput: String(MIN_MOVEMENT_QTY), available: 0 },
    ]);
  };

  const updateItem = (index: number, update: Partial<MovementItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...update };
      return next;
    });
  };

  const parseQuantityInput = (value?: string | number) => {
    if (typeof value === "number") return Math.max(0, value);
    if (value === undefined) return null;
    const sanitized = value.replace(/[^0-9]/g, "");
    if (sanitized === "") return null;
    return Math.max(0, parseInt(sanitized, 10));
  };

  const normalizeQuantityInput = (value: string | undefined, max: number) => {
    const parsed = parseQuantityInput(value);
    const normalized = parsed === null || parsed < MIN_MOVEMENT_QTY ? MIN_MOVEMENT_QTY : parsed;
    const clamped = Math.min(normalized, max);
    const display = String(clamped);
    return { parsed, clamped, display };
  };

  const handleCreateMovement = async () => {
    if (!fromBranch || !toBranch) {
      toast.error("Заполните филиалы");
      return;
    }
    if (fromBranch === toBranch) {
      toast.error("Нельзя перемещать в тот же филиал");
      return;
    }
    if (items.length === 0) {
      toast.error("Добавьте товары");
      return;
    }
    for (const item of items) {
      const parsedQty = parseQuantityInput(item.quantityInput ?? item.quantity) ?? 0;
      if (!item.product_id) {
        toast.error("Выберите товар");
        return;
      }
      if (parsedQty <= 0) {
        toast.error("Количество должно быть больше 0");
        return;
      }
      if (parsedQty > item.available) {
        toast.error(`Доступно только ${item.available} для ${item.product_name || "товара"}`);
        return;
      }
    }
    try {
      await apiPost("/api/movements", {
        from_branch_id: Number(fromBranch),
        to_branch_id: Number(toBranch),
        comment: comment || null,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: parseQuantityInput(item.quantityInput ?? item.quantity) ?? MIN_MOVEMENT_QTY,
          purchase_price: null,
          selling_price: null,
        })),
      });
      toast.success("Перемещение создано");
      setItems([]);
      setComment("");
      loadHistory();
      loadIncoming();
    } catch (error) {
      console.error(error);
      toast.error((error as any)?.message || "Не удалось создать перемещение");
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await apiPost(`/api/movements/${id}/accept`, {});
      toast.success("Перемещение принято");
      loadIncoming();
      loadHistory();
    } catch (error) {
      console.error(error);
      toast.error((error as any)?.message || "Ошибка при принятии");
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt("Укажите причину отклонения") || "";
    try {
      await apiPost(`/api/movements/${id}/reject?reason=${encodeURIComponent(reason)}`, {});
      toast.success("Перемещение отклонено");
      loadIncoming();
      loadHistory();
    } catch (error) {
      console.error(error);
      toast.error((error as any)?.message || "Ошибка при отклонении");
    }
  };

  const openMovementDetail = async (id: number) => {
    try {
      const detail = await apiGet<MovementDetail>(`/api/movements/${id}`);
      setSelectedMovement(detail);
      setShowMovementModal(true);
    } catch (error) {
      console.error(error);
      toast.error((error as any)?.message || "Не удалось загрузить детали перемещения");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Перемещения</h1>
        <p className="text-muted-foreground">Создание и обработка перемещений между филиалами</p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Откуда</Label>
            <Select
              value={fromBranch}
              onValueChange={(v) => {
                setFromBranch(v);
                setItems([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите филиал" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Куда</Label>
            <Select value={toBranch} onValueChange={setToBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите филиал" />
              </SelectTrigger>
              <SelectContent>
                {toBranchOptions.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Товары</h3>
          <Button variant="outline" onClick={handleAddItemRow}>
            Добавить
          </Button>
        </div>

        <div className="space-y-3">
          {items.length === 0 && <div className="text-muted-foreground text-sm">Добавьте товары для перемещения</div>}
          {items.map((item, index) => (
            <div key={index} className="grid md:grid-cols-3 gap-3 items-end border rounded-md p-3">
              <div>
                <Label>Товар</Label>
                <Select
                  value={item.product_id ? String(item.product_id) : ""}
                  onValueChange={(val) => {
                    const selected = stockOptions.find((opt) => opt.value === Number(val));
                    const currentQty = parseQuantityInput(item.quantityInput ?? item.quantity) ?? MIN_MOVEMENT_QTY;
                    const cappedQty = Math.min(currentQty, selected?.available || currentQty);
                    updateItem(index, {
                      product_id: Number(val),
                      available: selected?.available || 0,
                      product_name: selected?.label,
                      quantity: cappedQty,
                      quantityInput: item.quantityInput === "" ? "" : String(cappedQty || 0),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите товар" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label} (доступно: {opt.available})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Количество</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={item.quantityInput ?? String(item.quantity ?? 0)}
                  onFocus={() => {
                    if ((item.quantityInput ?? String(item.quantity)) === "0") {
                      updateItem(index, { quantityInput: "", quantity: 0 });
                    }
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const sanitized = raw.replace(/[^0-9]/g, "");
                    const parsed = sanitized === "" ? 0 : parseInt(sanitized, 10);
                    updateItem(index, { quantityInput: raw === "" ? "" : sanitized, quantity: parsed });
                  }}
                  onBlur={() => {
                    const { clamped, display } = normalizeQuantityInput(item.quantityInput ?? "0", item.available || 0);
                    updateItem(index, { quantity: clamped, quantityInput: display });
                  }}
                  className={
                    (parseQuantityInput(item.quantityInput ?? item.quantity) ?? 0) > item.available
                      ? "border-destructive focus-visible:ring-destructive"
                      : undefined
                  }
                />
                <div className="text-xs text-muted-foreground">Доступно: {item.available}</div>
                {(parseQuantityInput(item.quantityInput ?? item.quantity) ?? 0) > item.available && (
                  <div className="text-xs text-destructive">Количество превышает доступный остаток</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <Label>Комментарий</Label>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (опционально)" />
        </div>

        <Button onClick={handleCreateMovement}>Создать перемещение</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Входящие перемещения</h3>
          <Button variant="outline" onClick={loadIncoming}>Обновить</Button>
        </div>
        {incoming.length === 0 ? (
          <div className="text-sm text-muted-foreground">Нет входящих перемещений</div>
        ) : (
          incoming.map((m) => (
            <div key={m.id} className="border rounded-md p-3 space-y-2">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">
                    #{m.id} • {statusLabels[m.status] || m.status}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    От {m.from_branch_name || m.from_branch_id} → {m.to_branch_name || m.to_branch_id}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAccept(m.id)}>Принять</Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(m.id)}>Отклонить</Button>
                </div>
              </div>
              <div className="text-sm">
                {m.items.map((it) => (
                  <div key={it.id}>
                    {it.product_name || it.product_id} — {it.quantity}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">История перемещений</h3>
            <p className="text-sm text-muted-foreground">Фильтр по статусу</p>
          </div>
          <Select value={historyStatus} onValueChange={setHistoryStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="waiting">Ожидание</SelectItem>
              <SelectItem value="done">Завершено</SelectItem>
              <SelectItem value="rejected">Отклонено</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground">Нет перемещений</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Откуда</TableHead>
                <TableHead>Куда</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">#{m.id}</TableCell>
                  <TableCell>{m.from_branch_name || m.from_branch_id}</TableCell>
                  <TableCell>{m.to_branch_name || m.to_branch_id}</TableCell>
                  <TableCell>{statusLabels[m.status] || m.status}</TableCell>
                  <TableCell>{new Date(m.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openMovementDetail(m.id)}>
                      Подробнее
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showMovementModal} onOpenChange={setShowMovementModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали перемещения</DialogTitle>
          </DialogHeader>
          {selectedMovement && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div>Откуда: {selectedMovement.from_branch_name || selectedMovement.from_branch_id}</div>
                <div>Куда: {selectedMovement.to_branch_name || selectedMovement.to_branch_id}</div>
                <div>Статус: {statusLabels[selectedMovement.status] || selectedMovement.status}</div>
                <div>Создано: {new Date(selectedMovement.created_at).toLocaleString()}</div>
                {selectedMovement.processed_at && (
                  <div>Обработано: {new Date(selectedMovement.processed_at).toLocaleString()}</div>
                )}
                <div>Создал: {selectedMovement.created_by_name || "-"}</div>
                <div>Обработал: {selectedMovement.processed_by_name || "-"}</div>
              </div>
              {selectedMovement.comment && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Комментарий:</span> {selectedMovement.comment}
                </div>
              )}
              {selectedMovement.reason && (
                <div className="text-sm text-destructive">
                  <span className="text-muted-foreground">Причина:</span> {selectedMovement.reason}
                </div>
              )}
              <div>
                <h4 className="font-semibold mb-2">Товары</h4>
                <div className="space-y-1 text-sm">
                  {selectedMovement.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.product_name || item.product_id}</span>
                      <span>{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
