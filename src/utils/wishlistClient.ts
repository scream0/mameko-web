import { auth } from "@/lib/supabaseClient";
import { getApiBaseUrl } from "@/lib/apiClient";

const STORAGE_KEY = "shop_wishlist";

export function getLocalWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveLocalWishlist(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function notifyWishlistUpdated(items: string[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("wishlist-updated", {
      detail: { count: items.length, items },
    })
  );
}

/**
 * Fetch wishlist from Backend DB if authenticated, fallback to local storage
 */
export async function syncWishlistWithBackend(): Promise<string[]> {
  const localItems = getLocalWishlist();
  if (typeof window === "undefined") return localItems;

  try {
    const { data: { session } } = await auth.getSession();
    if (!session?.access_token) {
      return localItems;
    }

    const res = await fetch(`${getApiBaseUrl()}/api/user/wishlist`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        const remoteIds: string[] = json.data.map((id: any) => String(id));
        // Merge with local if any unique
        const merged = Array.from(new Set([...remoteIds]));
        saveLocalWishlist(merged);
        notifyWishlistUpdated(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn("Failed to sync wishlist with backend:", err);
  }

  return localItems;
}

/**
 * Toggle wishlist item with optimistic local update & backend sync
 */
export async function toggleWishlistItem(productId: string): Promise<boolean> {
  const idStr = String(productId).trim();
  if (!idStr) return false;

  const current = getLocalWishlist();
  const isExist = current.includes(idStr);
  const nextItems = isExist ? current.filter((id) => id !== idStr) : [...current, idStr];

  saveLocalWishlist(nextItems);
  notifyWishlistUpdated(nextItems);

  try {
    const { data: { session } } = await auth.getSession();
    if (session?.access_token) {
      await fetch(`${getApiBaseUrl()}/api/user/wishlist/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ product_id: idStr }),
      });
    }
  } catch (err) {
    console.warn("Failed to push wishlist toggle to backend:", err);
  }

  return !isExist;
}
