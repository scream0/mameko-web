// @ts-nocheck
"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Shop.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { supabase } from "@/lib/supabaseClient";
import { ShopSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import shopConfig from "@/data/ui/shopConfig.json";

const PRODUCTS_PER_PAGE = 12;

export default function Shop({ searchQuery = "", onBukaDetail, initialData }) {
  const { addToCart, activePromo } = useStore();

  const [products, setProducts] = useState(
    (initialData?.products || []).filter((p: any) => p.status !== "draft")
  );
  const [orderItemsMap, setOrderItemsMap] = useState(initialData?.salesMap || {});
  const [allReviews, setAllReviews] = useState(initialData?.reviews || []);
  const [loading, setLoading] = useState(!initialData);
  const [sortBy, setSortBy] = useState("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(initialData?.totalProducts || 0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Settings from DB / Config fallback
  const [resolvedHeader, setResolvedHeader] = useState(
    initialData?.publicSettings?.product?.header || {
      tagline: shopConfig.header?.fallbackTagline || "our curated collection",
      title: {
        main: shopConfig.header?.fallbackTitleMain || "Produk",
        highlight: shopConfig.header?.fallbackTitleHighlight || "Kami",
      },
    }
  );

  const [wishlist, setWishlist] = useState([]);

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
            tagline: data.product.header.tagline || shopConfig.header?.fallbackTagline || "our curated collection",
            title: {
              main: data.product.header.title?.main || shopConfig.header?.fallbackTitleMain || "Produk",
              highlight: data.product.header.title?.highlight || shopConfig.header?.fallbackTitleHighlight || "Kami",
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
  const shopRef = useRef(null);
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

  // Populate wishlist from localStorage (client-side only to prevent hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shop_wishlist");
      if (saved) {
        setWishlist(JSON.parse(saved));
      }
    } catch {
      // Ignore parsing error
    }
  }, []);

  const toggleWishlist = (productId: string, e: any) => {
    e.stopPropagation();
    const isExist = wishlist.includes(productId);
    const updated = isExist
      ? wishlist.filter((id) => id !== productId)
      : [...wishlist, productId];

    setWishlist(updated);

    try {
      localStorage.setItem("shop_wishlist", JSON.stringify(updated));
    } catch {}

    window.dispatchEvent(
      new CustomEvent("wishlist-updated", {
        detail: { count: updated.length, items: updated },
      })
    );

    import("react-hot-toast").then((toast) => {
      toast.default.success(
        isExist
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

      const fetches = [];
      if (shouldFetchProducts) {
        fetches.push(
          fetch(
            (process.env.NEXT_PUBLIC_API_URL || "") +
              `/api/products?${queryParams.toString()}`,
            { cache: "default" }
          )
        );
      } else {
        fetches.push(Promise.resolve(null));
      }
      fetches.push(
        fetch(
          (process.env.NEXT_PUBLIC_API_URL || "") + "/api/products/sales/public",
          { cache: "no-store" }
        )
      );
      fetches.push(
        fetch(
          (process.env.NEXT_PUBLIC_API_URL || "") + "/api/reviews?public=true",
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

  // Trigger data fetch on filter / pagination change
  useEffect(() => {
    const isInitialLoad =
      initialData && currentPage === 1 && sortBy === "default" && !debouncedSearch;
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
      channel = supabase
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
        supabase.removeChannel(channel);
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

  return (
    <div
      className={`${styles.shopContainer} ${isVisible ? styles.visible : ""}`}
      ref={shopRef}
    >
      {/* Header */}
      <header className={styles.shopHeader}>
        <p className={styles.shopTagline}>{resolvedHeader.tagline}</p>
        <h2>
          {resolvedHeader.title?.main}{" "}
          <span>{resolvedHeader.title?.highlight}</span>
        </h2>
      </header>

      {/* Filter Tabs (Pill Buttons) */}
      <nav
        className={styles.filterTabsWrapper}
        role="tablist"
        aria-label="Filter Urutan Produk"
      >
        {sortOptions.map((option) => (
          <button
            key={option.id}
            role="tab"
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
                    {productImg ? (
                      <Image
                        src={productImg}
                        alt={product.name}
                        className={styles.productCardImg}
                        width={320}
                        height={320}
                      />
                    ) : (
                      <div className={styles.productCardPlaceholder}>
                        {shopConfig.card?.placeholderImageText || "MAMEKO PARFUM"}
                      </div>
                    )}

                    <span className={styles.cardCategoryBadge}>
                      {product.category ||
                        shopConfig.card?.defaultCategory ||
                        "Parfum"}
                    </span>

                    <button
                      className={`${styles.wishlistBtn} ${
                        isWishlisted ? styles.wishlistActive : ""
                      }`}
                      onClick={(e) => toggleWishlist(pId, e)}
                      aria-label={shopConfig.aria?.wishlist || "Wishlist"}
                    >
                      <svg viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                        />
                      </svg>
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
                        <AppIcon name="shopping-cart" />
                      </button>
                    </div>

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
                      {averageRating
                        ? `★ ${averageRating} (${productReviews.length})`
                        : shopConfig.reviews?.noReviewsYet || "Belum ada ulasan"}
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
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className={styles.loadMoreBtn}
                >
                  {shopConfig.buttons?.loadMore || "Lihat Lebih Banyak"}
                </button>
              </div>
            )}
        </>
      )}
    </div>
  );
}
