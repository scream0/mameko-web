"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Shop.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { mamekoClient } from "@/lib/mamekoClient";
import { ShopSkeleton } from "@/components/UI/Skeleton/ShopSkeleton";
import shopConfig from "@/data/ui/shopConfig.json";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";
import { getApiBaseUrl } from "@/lib/apiClient";
import { getLocalWishlist, syncWishlistWithBackend, toggleWishlistItem } from "@/utils/wishlistClient";

const PRODUCTS_PER_PAGE = 12;

export default function Shop({ searchQuery = "", onBukaDetail, initialData }: { searchQuery?: string; onBukaDetail?: any; initialData?: any } = {}) {
  const { addToCart, activePromo } = useStore();

  const [products, setProducts] = useState(
    (initialData?.products || []).filter((p: any) => p.status !== "draft")
  );
  const [orderItemsMap, setOrderItemsMap] = useState(initialData?.salesMap || {});
  const [allReviews, setAllReviews] = useState(initialData?.reviews || []);
  const [loading, setLoading] = useState(
    !initialData?.products || initialData.products.length === 0
  );
  const [sortBy, setSortBy] = useState("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(initialData?.totalProducts || 0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Settings from DB / Config fallback
  const [resolvedHeader, setResolvedHeader] = useState(
    initialData?.publicSettings?.product?.header || {
      title: {
        main: shopConfig.header?.fallbackTitleMain || "Produk",
        highlight: shopConfig.header?.fallbackTitleHighlight || "Kami",
      },
    }
  );

  const [wishlist, setWishlist] = useState<any[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Debounced search query
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Unified public settings fetch (runs once on mount)
  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        const data = await getPublicSettings();
        if (!data || !isMounted) return;
        if (data?.product?.header) {
          setResolvedHeader({
            title: {
              main:
                data.product.header.title?.main ||
                shopConfig.header?.fallbackTitleMain ||
                "Produk",
              highlight:
                data.product.header.title?.highlight ||
                shopConfig.header?.fallbackTitleHighlight ||
                "Kami",
            },
          });
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan produk di katalog:", err);
      }
    };
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Scroll Reveal Animation
  const shopRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );

    if (shopRef.current) {
      observer.observe(shopRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Populate wishlist from local storage & sync with Golang Backend DB
  useEffect(() => {
    setWishlist(getLocalWishlist());
    syncWishlistWithBackend().then((items) => {
      if (items && items.length > 0) setWishlist(items);
    });
  }, []);

  const toggleWishlist = async (productId: string, e: any) => {
    e.stopPropagation();
    const isNowAdded = await toggleWishlistItem(productId);
    const updated = isNowAdded
      ? Array.from(new Set([...wishlist, productId]))
      : wishlist.filter((id) => id !== productId);

    setWishlist(updated);

    import("react-hot-toast").then((toast) => {
      toast.default.success(
        !isNowAdded
          ? shopConfig.toasts?.wishlistRemove || "Dihapus dari wishlist."
          : shopConfig.toasts?.wishlistAdd || "Berhasil ditambahkan ke wishlist!"
      );
    });
  };

  const fetchShopData = useCallback(
    async (shouldFetchProducts = true, append = false) => {
      if (shouldFetchProducts) {
        if (!append) {
          setLoading(true);
        } else {
          setIsFetchingMore(true);
        }
      }

      const queryParams = new URLSearchParams();
      if (debouncedSearch) queryParams.append("search", debouncedSearch);
      queryParams.append("sortBy", sortBy);
      queryParams.append("page", currentPage.toString());
      queryParams.append("limit", PRODUCTS_PER_PAGE.toString());
      queryParams.append("status", "published");

      const baseUrl = getApiBaseUrl();
      const fetches = [];
      if (shouldFetchProducts) {
        fetches.push(
          fetch(
            `${baseUrl}/api/products?${queryParams.toString()}`,
            { cache: "default" }
          )
        );
      } else {
        fetches.push(Promise.resolve(null));
      }
      fetches.push(
        fetch(
          `${baseUrl}/api/products/sales/public`,
          { cache: "no-store" }
        )
      );
      fetches.push(
        fetch(
          `${baseUrl}/api/reviews?public=true`,
          { cache: "no-store" }
        )
      );

      const [productsResult, salesResult, reviewsResult] =
        await Promise.allSettled(fetches);

      // Process Products
      if (productsResult.status === "fulfilled" && productsResult.value) {
        const res = productsResult.value;
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const result = await res.json();
          const rawProducts = result.data || result.products || result || [];
          const fetchedProducts = rawProducts.filter(
            (p: any) => p.status !== "draft"
          );
          setProducts((prev: any) =>
            append ? [...prev, ...fetchedProducts] : fetchedProducts
          );
          setTotalProducts(result.total || 0);
        } else if (res) {
          const errorText = await res.text();
          console.error("Gagal memuat produk:", errorText);
        }
      } else if (productsResult.status === "rejected") {
        console.error("Gagal memuat produk:", productsResult.reason);
      }

      // Process Sales Data
      if (salesResult.status === "fulfilled") {
        const res = salesResult.value;
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const result = await res.json();
          setOrderItemsMap(result.sales || {});
        } else {
          console.warn(shopConfig.messages?.salesUnavailable || "Data penjualan belum tersedia.");
        }
      }

      // Process Reviews
      if (reviewsResult.status === "fulfilled") {
        const res = reviewsResult.value;
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const result = await res.json();
          setAllReviews(result.reviews || []);
        } else {
          console.warn(shopConfig.messages?.reviewsUnavailable || "Data ulasan belum tersedia.");
        }
      }

      setLoading(false);
      setIsFetchingMore(false);
    },
    [debouncedSearch, sortBy, currentPage]
  );

  // Trigger data fetch on filter / pagination change, or when initialData has no products
  useEffect(() => {
    const hasInitialProducts =
      Array.isArray(initialData?.products) && initialData.products.length > 0;
    const isInitialLoad =
      hasInitialProducts &&
      currentPage === 1 &&
      sortBy === "default" &&
      !debouncedSearch;
    if (isInitialLoad) {
      return;
    }

    if (currentPage !== 1 && (debouncedSearch || sortBy !== "default")) {
      setCurrentPage(1);
    } else {
      fetchShopData(true, currentPage > 1);
    }
  }, [debouncedSearch, sortBy, currentPage, fetchShopData, initialData]);

  // Realtime subscription
  useEffect(() => {
    let channel: any;
    const timer = setTimeout(() => {
      const refreshCatalog = () => fetchShopData(true);
      channel = mamekoClient
        .channel("storefront-catalog")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          refreshCatalog
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reviews" },
          refreshCatalog
        )
        .subscribe();
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (channel) {
        mamekoClient.removeChannel(channel);
      }
    };
  }, [fetchShopData]);

  // Storage/stock updated event listener
  useEffect(() => {
    const handleStorageChange = () => fetchShopData(true);
    window.addEventListener("product-stock-updated", handleStorageChange);
    return () => {
      window.removeEventListener("product-stock-updated", handleStorageChange);
    };
  }, [fetchShopData]);

  const handleLoadMore = () => {
    setCurrentPage((prevPage) => prevPage + 1);
  };

  const getVariantStock = (variant: any) =>
    Number(variant?.stock ?? variant?.stok ?? 0);

  const getProductTotalStock = (product: any) => {
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.reduce((acc, v: any) => acc + getVariantStock(v), 0);
    }
    return getVariantStock(product);
  };

  const isProductOutOfStock = (product: any) => {
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.every((v: any) => getVariantStock(v) <= 0);
    }
    return getVariantStock(product) <= 0;
  };

  const getFirstAvailableVariantIndex = (product: any) => {
    const idx = (product.variants || []).findIndex(
      (v: any) => getVariantStock(v) > 0
    );
    return idx !== -1 ? idx : 0;
  };

  const sortOptions = shopConfig.sortOptions || [
    { id: "default", label: "Terbaru" },
    { id: "price-low", label: "Harga Terendah" },
    { id: "price-high", label: "Harga Tertinggi" },
    { id: "name", label: "Nama (A-Z)" },
  ];

  const productSectionTitle = useMemo(() => {
    const main = resolvedHeader?.title?.main?.trim();
    const highlight = resolvedHeader?.title?.highlight?.trim();
    if (main && highlight) {
      return `${main} ${highlight}`;
    }
    if (main) return main;
    if (highlight) return highlight;
    return shopConfig.header?.title || "Produk Kami";
  }, [resolvedHeader]);

  return (
    <section
      id="product"
      className={`${styles.shopSection} ${isVisible ? styles.visible : ""}`}
      ref={shopRef}
      aria-label={productSectionTitle}
    >
      <div className={styles.shopContainer}>
        {/* Header (Single Solid Color, Clean Minimalist) */}
        <header className={styles.shopHeader}>
          <h2 className={styles.shopTitle}>
            {productSectionTitle}
          </h2>
        </header>

        {/* Filter Tabs (Pill Buttons) */}
        <nav
          className={styles.filterTabsWrapper}
          role="tablist"
          aria-label={shopConfig.filters?.allLabel || "Filter Urutan Produk"}
        >
          <div className={styles.filterPillTrack}>
            {sortOptions.map((option) => (
              <button
                key={option.id}
                role="tab"
                type="button"
                aria-selected={sortBy === option.id}
                onClick={() => {
                  setSortBy(option.id);
                  setCurrentPage(1);
                }}
                className={`${styles.filterTabBtn} ${
                  sortBy === option.id ? styles.activeFilterTab : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Product List */}
        {loading ? (
          <ShopSkeleton count={PRODUCTS_PER_PAGE} />
        ) : products.length === 0 && !isFetchingMore ? (
          <div className={styles.stateContainer}>
            <p>{shopConfig.messages?.empty || "Belum ada produk yang tersedia."}</p>
          </div>
        ) : (
          <>
            <div className={styles.productGrid}>
              {products.map((product: any) => {
                const pId = String(product.id || product._id || "");
                const totalSold =
                  orderItemsMap[pId] || Number(product.total_sold || 0);

                const availableVariantIdx = getFirstAvailableVariantIndex(product);
                const activeVariant =
                  product.variants?.[availableVariantIdx] || product.variants?.[0];

                // Base price correctly derived from active variant or product
                const displayPrice = Number(
                  activeVariant?.price ?? product.price ?? 0
                );
                const priceFormatted = displayPrice
                  ? `Rp ${displayPrice.toLocaleString("id-ID")}`
                  : shopConfig.card?.fallbackPrice || "Rp 0";

                const outOfStock = isProductOutOfStock(product);
                const totalStockLeft = getProductTotalStock(product);
                const isWishlisted = wishlist.includes(pId);

                // Reviews match safely with productId or product_id
                const productReviews = allReviews.filter(
                  (review: any) =>
                    String(review.productId || review.product_id) === pId
                );
                const averageRating = productReviews.length
                  ? (
                      productReviews.reduce(
                        (sum, review: any) => sum + Number(review.rating || 0),
                        0
                      ) / productReviews.length
                    ).toFixed(1)
                  : null;

                const productImg =
                  product.image_url || product.imageUrl || product.image;

                // Calculate discount based on active variant
                const discounted = getDiscountedPrice(displayPrice, activePromo, {
                  productId: pId,
                  size: activeVariant?.size,
                });

                return (
                  <article
                    key={pId}
                    className={`${styles.productCard} ${
                      outOfStock ? styles.outOfStock : ""
                    }`}
                    onClick={() => onBukaDetail(product)}
                  >
                    {/* Image Section */}
                    <div className={styles.productCardImageWrapper}>
                      {productImg && !failedImages[pId] ? (
                        <Image
                          src={optimizeCloudinaryUrl(productImg, IMAGE_PRESETS.PRODUCT_CARD)}
                          alt={product.name}
                          className={styles.productCardImg}
                          width={320}
                          height={320}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          onError={() => setFailedImages((prev) => ({ ...prev, [pId]: true }))}
                        />
                      ) : (
                        <Image
                          src="/placeholder.jpg"
                          alt={product.name || "MAMEKO PARFUM"}
                          className={styles.productCardImg}
                          width={320}
                          height={320}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      )}

                      <span className={styles.cardCategoryBadge}>
                        {product.category ||
                          shopConfig.card?.defaultCategory ||
                          "Parfum"}
                      </span>

                      <button
                        type="button"
                        className={`${styles.wishlistBtn} ${
                          isWishlisted ? styles.wishlistActive : ""
                        }`}
                        onClick={(e) => toggleWishlist(pId, e)}
                        aria-label={shopConfig.aria?.wishlist || "Wishlist"}
                      >
                        <AppIcon
                          name="heart"
                          size={17}
                          className={styles.wishlistIcon}
                        />
                      </button>

                      {outOfStock && (
                        <span className={styles.outOfStockBadge}>
                          {shopConfig.card?.soldOutBadge || "Habis"}
                        </span>
                      )}
                    </div>

                    {/* Body Section */}
                    <div className={styles.productCardBody}>
                      <div className={styles.cardTopInfo}>
                        <h3 className={styles.productName}>{product.name}</h3>
                        <button
                          type="button"
                          className={`${styles.cartIconBtn} ${
                            outOfStock ? styles.cartIconBtnDisabled : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!outOfStock) {
                              const variantToAdd = activeVariant || {
                                size:
                                  shopConfig.card?.defaultVariant || "Standard",
                                price: displayPrice,
                                stock: 10,
                              };
                              addToCart(product, variantToAdd, 1);
                            }
                          }}
                          disabled={outOfStock}
                          aria-label={
                            shopConfig.card?.addToCartTitle ||
                            shopConfig.aria?.addToCart ||
                            "Tambah ke keranjang"
                          }
                        >
                          <AppIcon name="shopping-bag" size={16} />
                        </button>
                      </div>

                      {/* Variant Badges Cue */}
                      {Array.isArray(product.variants) && product.variants.length > 0 && (
                        <div className={styles.variantBadgesList}>
                          {product.variants.map((v: any, vIdx: number) => (
                            <span
                              key={v.id || v.size || vIdx}
                              className={styles.variantBadgeItem}
                            >
                              {v.size || v.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Price & Discounts */}
                      <div className={styles.cardPriceRow}>
                        {outOfStock ? (
                          <span className={styles.cardPrice}>
                            {shopConfig.card?.outOfStockTitle || "Stok Habis"}
                          </span>
                        ) : (
                          <>
                            {discounted.hasDiscount && (
                              <span className={styles.cardOriginalPrice}>
                                {priceFormatted}
                              </span>
                            )}
                            <span className={styles.cardPrice}>
                              {`Rp ${Number(discounted.price).toLocaleString(
                                "id-ID"
                              )}`}
                            </span>
                            {discounted.hasDiscount && (
                              <span className={styles.cardDiscountBadge}>
                                {shopConfig.card?.savingsPrefix || "Hemat "}
                                {`Rp ${Number(discounted.savings).toLocaleString(
                                  "id-ID"
                                )}`}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Review Summary */}
                      <div className={styles.reviewSummary}>
                        {averageRating ? (
                          <span className={styles.starRatingPill}>
                            ★ {averageRating} ({productReviews.length})
                          </span>
                        ) : (
                          <span className={styles.noReviewText}>
                            {shopConfig.reviews?.noReviewsYet || "Belum ada ulasan"}
                          </span>
                        )}
                      </div>

                      {/* Footer / Stock Indicator */}
                      <div className={styles.cardFooterInfo}>
                        <span
                          className={
                            outOfStock
                              ? styles.soldCount
                              : totalStockLeft <= 5
                              ? styles.stockIndicatorLow
                              : styles.stockIndicator
                          }
                        >
                          {outOfStock
                            ? `${shopConfig.card?.soldPrefix || "Terjual "}${totalSold}`
                            : `${
                                shopConfig.card?.stockRemainingPrefix || "Sisa "
                              }${totalStockLeft}${
                                shopConfig.card?.stockRemainingSuffix || " lagi!"
                              }`}
                        </span>
                        <span className={styles.viewDetailText}>
                          {shopConfig.card?.viewDetail || "Detail"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination Load More */}
            {products.length < totalProducts &&
              currentPage * PRODUCTS_PER_PAGE < totalProducts && (
                <div className={styles.paginationWrapper}>
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isFetchingMore}
                    className={styles.loadMoreBtn}
                  >
                    <span>
                      {shopConfig.buttons?.loadMore || "Lihat Lebih Banyak"}
                    </span>
                    {isFetchingMore ? (
                      <AppIcon
                        name="loader"
                        size={16}
                        className={styles.loadingSpinner}
                      />
                    ) : (
                      <AppIcon
                        name="arrow-right"
                        size={16}
                        className={styles.arrowMoreIcon}
                      />
                    )}
                  </button>
                </div>
              )}
          </>
        )}
      </div>
    </section>
  );
}
