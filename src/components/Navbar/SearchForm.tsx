// @ts-nocheck
"use client";
import { useEffect, useRef } from "react";
import styles from "./SearchForm.module.css";
import searchData from "@/data/ui/searchFormConfig.json";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";

export function SearchForm({
  isActive,
  searchQuery,
  setSearchQuery,
  filteredProdukItems = [],
  onResultClick,
  rupiah,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [isActive]);

  return (
    <div className={`${styles.searchForm} ${isActive ? styles.active : ""}`}>
      <input
        ref={inputRef}
        type="search"
        placeholder={searchData?.input?.placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {searchQuery.trim() !== "" && (
        <div className={styles.searchResults}>
          {filteredProdukItems?.length > 0 ? (
            filteredProdukItems.map((item, index) => {
              // Menyesuaikan dengan skema database terpusat
              const availableVariants =
                item.variants?.filter((v: any) => (v.stock ?? 0) > 0) || [];
              const isAvailable =
                item.variants && item.variants.length > 0
                  ? availableVariants.length > 0
                  : true;

              // Ambil harga dari varian yang aktif, atau fallback ke harga utama produk
              const displayPrice =
                availableVariants[0]?.price ||
                item.variants?.[0]?.price ||
                item.price ||
                0;

              const rawImg = item?.image_url || item?.imageUrl;
              const optimizedImg = optimizeCloudinaryUrl(rawImg, IMAGE_PRESETS.THUMBNAIL_SM) || searchData?.results?.defaultImage;

              return (
                <div
                  key={item?.id || `${item?.name || "product"}-${index}`}
                  className={`${styles.searchResultItem} ${!isAvailable ? styles.disabled : ""}`}
                  onClick={() =>
                    isAvailable && onResultClick && onResultClick(item)
                  }
                >
                  <img
                    src={optimizedImg}
                    alt={item?.name}
                  />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{item?.name}</span>
                    <div className="product-price">
                      {isAvailable ? (
                        <p>
                          {searchData?.results?.pricePrefix}{" "}
                          {rupiah
                            ? rupiah(displayPrice)
                            : `Rp ${Number(displayPrice).toLocaleString("id-ID")}`}
                        </p>
                      ) : (
                        <p className={styles.outOfStockText}>
                          {searchData?.results?.outOfStock}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.searchResultEmpty}>
              {searchData?.results?.emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
