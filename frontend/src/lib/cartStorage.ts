export const CART_STORAGE_KEY = "pos_cart_state";
export const CART_TTL_MS = 60 * 60 * 1000; // 1 hour

export type StoredCartState<T> = {
  userId: number;
  updatedAt: number;
  cart: T[];
};

export function loadStoredCart<T>(userId: number): StoredCartState<T> | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCartState<T>;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.updatedAt > CART_TTL_MS) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Failed to parse stored cart", error);
    localStorage.removeItem(CART_STORAGE_KEY);
    return null;
  }
}

export function saveCartState<T>(userId: number, cart: T[]) {
  if (typeof window === "undefined") return;
  const payload: StoredCartState<T> = {
    userId,
    updatedAt: Date.now(),
    cart,
  };
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
}

export function clearCartState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_STORAGE_KEY);
}
