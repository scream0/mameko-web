// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import styles from "./CartSidebar.module.css";
import cartConfig from "@/data/ui/cartSidebarConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { useScrollLock } from "@/hooks/useScrollLock";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";
import dynamic from "next/dynamic";

const AddressModal = dynamic(
  () => import("@/components/UI/Modal/AddressModal").then((mod) => mod.AddressModal),
  { ssr: false }
);

export function CartSidebar() {
  const router = useRouter();
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    addToCart,
    cartTotal,
    rupiah,
    products,
    updateCartItemVariant,
    getAvailableVariants,
    processPayment,
    isProcessing,
    user,
    activePromo,
    promoSavings,
    discountedCartTotal,
    isAddressModalOpen,
  } = useStore();

  useScrollLock(isCartOpen);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, cartId: null });

  const closeSidebar = () => setIsCartOpen(false);

  const productList = Array.isArray(products) ? products : products?.data || [];

  const handleCheckoutClick = async () => {
    if (!user) {
      if (typeof window !== "undefined") {
        localStorage.setItem("pending_cart", JSON.stringify(cart));
      }
      closeSidebar();
      router.push("/login?callbackUrl=/checkout");
      return;
    }
    closeSidebar();
    router.push("/checkout");
  };

  const handleExploreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    closeSidebar();
    router.push(cartConfig?.emptyState?.buttonLink || "/#product");
  };

  const triggerRemove = (cartId: string) => {
    setConfirmModal({ isOpen: true, cartId });
  };

  const confirmDelete = () => {
    if (confirmModal.cartId) {
      removeFromCart(confirmModal.cartId, "all");
    }
    setConfirmModal({ isOpen: false, cartId: null });
  };

  const cancelDelete = () => {
    setConfirmModal({ isOpen: false, cartId: null });
  };

  return (
    <>
      <div
        className={`${styles.sidebarOverlay} ${isCartOpen ? styles.active : ""}`}
        onClick={closeSidebar}
      ></div>
      <aside
        className={`${styles.cartSidebar} ${isCartOpen ? styles.active : ""}`}
      >
        <header className={styles.cartHeader}>
          <h3 className={styles.cartSidebarTitle}>
            {cartConfig?.labels?.title || "Keranjang Belanja"}
          </h3>
          <button
            className={styles.cartCloseBtn}
            onClick={closeSidebar}
            aria-label={cartConfig?.accessibility?.closeAriaLabel || "Tutup Keranjang"}
          >
            <AppIcon name={cartConfig?.icons?.close || "x"} className={styles.svgIcon} />
          </button>
        </header>

        {cart?.items?.length > 0 ? (
          <>
            <div className={styles.cartItemsWrapper}>
              {cart.items.map((item: any) => {
                // Safety net: fallback key kalau cartId dari data lama kosong
                const safeKey =
                  item.cartId || `${item.productId || item.id}-${item.size}`;

                const originalProduct = productList.find(
                  (p: any) => String(p.id) === String(item.id || item.productId),
                );
                const variantInfo = originalProduct?.variants?.find(
                  (v: any) =>
                    String(v.size || "").toLowerCase() ===
                    String(item.size || "").toLowerCase(),
                );
                const maxStock = Number(
                  variantInfo?.stock ?? variantInfo?.stok ?? item.stock ?? 10,
                );
                const isMaxReached = item.quantity >= maxStock;

                const placeholderSvg =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

                const itemImageSrc =
                  item.image ||
                  variantInfo?.image_url ||
                  variantInfo?.imageUrl ||
                  originalProduct?.image_url ||
                  originalProduct?.imageUrl ||
                  placeholderSvg;

                const disc = activePromo
                  ? getDiscountedPrice(item.price, activePromo, {
                      productId: item.productId || item.id,
                      size: item.size,
                    })
                  : null;
                const hasDiscount = Boolean(disc && disc.hasDiscount);

                return (
                  <div className={styles.cartItem} key={safeKey}>
                    <div className={styles.cartItemImg}>
                      <img src={optimizeCloudinaryUrl(itemImageSrc, IMAGE_PRESETS.THUMBNAIL)} alt={item.name} />
                    </div>
                    <div className={styles.cartItemDetails}>
                      <div className={styles.itemHeader}>
                        <h4 className={styles.cartItemName}>{item.name}</h4>
                        <button
                          className={styles.removeItemBtn}
                          onClick={() => triggerRemove(item.cartId)}
                          aria-label={
                            cartConfig?.accessibility?.removeItemAria?.replace(
                              "{name}",
                              item.name,
                            ) || `Hapus ${item.name} dari keranjang`
                          }
                          title={
                            cartConfig?.accessibility?.removeItemTitle ||
                            "Hapus Item"
                          }
                        >
                          <AppIcon
                            name={cartConfig?.icons?.trash || "trash-2"}
                            className={styles.svgIcon}
                          />
                        </button>
                      </div>

                      <div className={styles.cartVariantSelector}>
                        <span>{cartConfig?.labels?.variant || "Varian:"}</span>
                        <select
                          value={item.size}
                          onChange={(e) =>
                            updateCartItemVariant(item.cartId, e.target.value)
                          }
                        >
                          {(() => {
                            const variants = getAvailableVariants(item.productId || item.id, item);
                            if (!variants || variants.length === 0) {
                              return (
                                <option value={item.size || "Standard"}>
                                  {item.size || "Standard"}
                                </option>
                              );
                            }
                            return variants.map((v: any) => {
                              const vStock = Number(v.stock ?? v.stok ?? 0);
                              const isOutOfStock = vStock <= 0;
                              return (
                                <option
                                  key={v.size}
                                  value={v.size}
                                  disabled={isOutOfStock}
                                >
                                  {v.size}{" "}
                                  {isOutOfStock
                                    ? cartConfig?.labels?.stockOut || "(Habis)"
                                    : cartConfig?.labels?.stockRemaining?.replace(
                                        "{stock}",
                                        String(vStock),
                                      ) || `(Sisa: ${vStock})`}
                                </option>
                              );
                            });
                          })()}
                        </select>
                      </div>

                      {hasDiscount && (
                        <span className={styles.promoBadge}>
                          <AppIcon
                            name={cartConfig?.icons?.tag || "tag"}
                            className={styles.promoBadgeIcon}
                          />
                          {cartConfig?.promo?.badge || "PROMO TOKO"}{" "}
                          {activePromo?.promoDiscountType === "fixed"
                            ? rupiah(activePromo.promoDiscountValue)
                            : cartConfig?.promo?.percentageTemplate
                            ? cartConfig.promo.percentageTemplate.replace(
                                "{value}",
                                String(activePromo?.promoDiscountValue || 0)
                              )
                            : `${activePromo?.promoDiscountValue}%`}
                        </span>
                      )}

                      <div className={styles.cartItemPriceRow}>
                        <span className={styles.cartPriceGroup}>
                          {hasDiscount && (
                            <span className={styles.cartOriginalPrice}>
                              {rupiah(item.price)}
                            </span>
                          )}
                          <span className={styles.cartCurrentPrice}>
                            {rupiah(hasDiscount ? disc.price : item.price)}
                          </span>
                        </span>
                        <div className={styles.cartQtyControl}>
                          <button
                            className={`${styles.cartQtyBtn} ${item.quantity === 1 ? styles.disabled : ""}`}
                            disabled={item.quantity === 1 || isProcessing}
                            onClick={() => removeFromCart(item.cartId)}
                            aria-label={
                              cartConfig?.accessibility?.decreaseQtyAria?.replace(
                                "{name}",
                                item.name,
                              ) || `Kurangi jumlah ${item.name}`
                            }
                          >
                            {cartConfig?.labels?.quantityMinus || "−"}
                          </button>
                          <span className={styles.cartQtyValue}>
                            {item.quantity}
                          </span>
                          <button
                            className={`${styles.cartQtyBtn} ${isMaxReached ? styles.disabled : ""}`}
                            disabled={isMaxReached || isProcessing}
                            aria-label={
                              cartConfig?.accessibility?.increaseQtyAria?.replace(
                                "{name}",
                                item.name,
                              ) || `Tambah jumlah ${item.name}`
                            }
                            onClick={() => {
                              if (!isMaxReached) {
                                const productTarget = originalProduct || {
                                  id: item.productId,
                                  variants: [
                                    {
                                      size: item.size,
                                      stock: maxStock,
                                      price: item.price,
                                    },
                                  ],
                                };
                                addToCart(productTarget, item.size, 1);
                              }
                            }}
                          >
                            {cartConfig?.labels?.quantityPlus || "+"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className={styles.cartFooterWrapper}>
              {activePromo && promoSavings > 0 && (
                <div className={styles.cartBreakdown}>
                  <div className={styles.cartBreakdownRow}>
                    <span className={styles.cartBreakdownLabel}>
                      {cartConfig?.labels?.subtotal || "Subtotal"}
                    </span>
                    <span className={styles.cartBreakdownValue}>
                      {rupiah(cartTotal)}
                    </span>
                  </div>
                  <div className={styles.cartDiscountRow}>
                    <span className={styles.cartBreakdownLabel}>
                      <AppIcon
                        name={cartConfig?.icons?.tag || "tag"}
                        className={styles.promoBadgeIcon}
                      />
                      {cartConfig?.labels?.promoDiscount || "Diskon Promo Toko"}
                    </span>
                    <span className={styles.cartDiscountValue}>
                      - {rupiah(promoSavings)}
                    </span>
                  </div>
                </div>
              )}

              <div className={styles.cartTotalRow}>
                <span className={styles.cartTotalLabel}>{cartConfig?.labels?.total || "Total Pembayaran:"}</span>
                <span className={styles.cartGrandTotal}>
                  {rupiah(activePromo ? discountedCartTotal : cartTotal)}
                </span>
              </div>
              <button
                className={styles.cartCheckoutBtn}
                onClick={handleCheckoutClick}
                disabled={isProcessing}
              >
                {isProcessing
                  ? cartConfig?.labels?.processing || "Memproses..."
                  : cartConfig?.labels?.checkout || "Bayar Sekarang"}
              </button>
            </footer>
          </>
        ) : (
          <div className={styles.emptyCartStatus}>
            <div className={styles.emptyCartIcon}>
              <AppIcon
                name={cartConfig?.icons?.emptyCart || "shopping-cart"}
                className={styles.svgIcon}
              />
            </div>
            <p>{cartConfig?.emptyState?.message || "Keranjang Anda Kosong"}</p>
            <button
              className={styles.btnContinueShopping}
              onClick={handleExploreClick}
            >
              {cartConfig?.emptyState?.buttonText || "Jelajahi Produk"}
            </button>
          </div>
        )}
      </aside>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <h3 className={styles.confirmModalTitle}>{cartConfig?.confirmModal?.title || "Hapus Item"}</h3>
            <p>
              {cartConfig?.confirmModal?.message ||
                "Apakah Anda yakin ingin menghapus item ini dari keranjang?"}
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.btnCancel} onClick={cancelDelete}>
                {cartConfig?.confirmModal?.cancelBtn || "Batal"}
              </button>
              <button className={styles.btnConfirm} onClick={confirmDelete}>
                {cartConfig?.confirmModal?.confirmBtn || "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddressModalOpen && <AddressModal />}
    </>
  );
}