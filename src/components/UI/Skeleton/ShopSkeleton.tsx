"use client";

import React from "react";
import styles from "./ShopSkeleton.module.css";

interface ShopSkeletonProps {
  count?: number;
  className?: string;
}

/* --- Ultra-lightweight, GPU-accelerated Shop catalog skeleton --- */
export function ShopSkeleton({ count = 12, className = "" }: ShopSkeletonProps) {
  return (
    <div
      className={`${styles.skeletonGrid} ${className}`.trim()}
      role="status"
      aria-label="Memuat produk katalog..."
    >
      {Array.from({ length: count }).map((_, i) => (
        <article key={`shop-skeleton-${i}`} className={styles.skeletonCard}>
          {/* Image Section (1:1 aspect ratio with category pill & wishlist button placeholder) */}
          <div className={styles.imageWrapper}>
            <div className={`${styles.categoryBadgePlaceholder} ${styles.shimmer}`} />
            <div className={`${styles.wishlistButtonPlaceholder} ${styles.shimmer}`} />
          </div>

          {/* Body Section (matching exact product card hierarchy) */}
          <div className={styles.cardBody}>
            {/* Title + Cart button */}
            <div className={styles.titleRow}>
              <div className={`${styles.titleLine} ${styles.shimmer}`} />
              <div className={`${styles.cartButtonPlaceholder} ${styles.shimmer}`} />
            </div>

            {/* Price + Discount badge */}
            <div className={styles.priceRow}>
              <div className={`${styles.priceLine} ${styles.shimmer}`} />
              <div className={`${styles.discountBadgePlaceholder} ${styles.shimmer}`} />
            </div>

            {/* Review summary */}
            <div className={`${styles.ratingLine} ${styles.shimmer}`} />

            {/* Footer stock indicator & detail link */}
            <div className={styles.footerRow}>
              <div className={`${styles.stockLine} ${styles.shimmer}`} />
              <div className={`${styles.detailLine} ${styles.shimmer}`} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default ShopSkeleton;

