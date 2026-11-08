"use client";

import React, { useState, useEffect } from "react";
import styles from "./ProductModal.module.css";
import modalData from "@/data/ui/productModalConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import { useScrollLock } from "@/hooks/useScrollLock";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";
import { getApiBaseUrl } from "@/lib/apiClient";

export interface ModalProps {
  isOpen: boolean;
  item: any;
  onClose: () => void;
  onAddToCart?: (item: any, qty: number, variant: any) => void;
  onTanyaProduk?: (item: any) => void;
  rupiah?: (val: number) => string;
}

export function Modal({
  isOpen,
  item,
  onClose,
  onAddToCart,
  onTanyaProduk,
  rupiah,
}: ModalProps) {
  useScrollLock(Boolean(isOpen && item));
  const { activePromo } = useStore();
  const [currentSize, setCurrentSize] = useState("");
  const [modalQty, setModalQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [isClosing, setIsClosing] = useState(false);

  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);

  useEffect(() => {
    if (!item) return;

    const availableVariants =
      item?.variants?.filter((v: any) => (v.stock ?? 0) > 0) || [];

    if (availableVariants.length > 0) {
      const currentIsStillAvailable = availableVariants.find(
        (v: any) => v.size === currentSize
      );

      if (!currentIsStillAvailable) {
        const firstAvailable = availableVariants[0];
        setCurrentSize(firstAvailable.size);
        setSelectedVariant(firstAvailable);
        setModalQty(1);
      }
    } else {
      setCurrentSize("");
      setSelectedVariant(null);
    }
  }, [item, currentSize]);

  useEffect(() => {
    if (!item?.id) return;
    setReviews([]);
    setReviewsPage(1);
    setHasMoreReviews(true);
    fetchReviews(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const fetchReviews = (pageToFetch: number) => {
    setLoadingReviews(true);
    fetch(
      getApiBaseUrl() +
        `/api/reviews?productId=${item.id}&public=true&page=${pageToFetch}&limit=10`
    )
      .then((res) => res.json())
      .then((data) => {
        const newReviews = data.reviews || [];
        if (pageToFetch === 1) {
          setReviews(newReviews);
        } else {
          setReviews((prev) => [...prev, ...newReviews]);
        }
        setHasMoreReviews(newReviews.length === 10);
      })
      .catch((err) => console.error("Failed to fetch reviews", err))
      .finally(() => setLoadingReviews(false));
  };

  const handleLoadMoreReviews = () => {
    const nextPage = reviewsPage + 1;
    setReviewsPage(nextPage);
    fetchReviews(nextPage);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  if (!isOpen || !item) return null;
  if (!isOpen && !isClosing) return null;

  const handleSizeChange = (variant: any) => {
    setCurrentSize(variant.size);
    setSelectedVariant(variant);
    setModalQty(1);
  };

  const handleAddToCart = () => {
    if (selectedVariant && onAddToCart) {
      onAddToCart(item, selectedVariant, modalQty);
      onClose();
    }
  };

  const displayedImage =
    selectedVariant?.image_url ||
    selectedVariant?.imageUrl ||
    item?.image_url ||
    item?.imageUrl ||
    "/placeholder.jpg";

  const formatRupiah = (val: any) => {
    if (rupiah) return rupiah(val);
    return `Rp ${Number(val).toLocaleString("id-ID")}`;
  };

  const rawPrice = selectedVariant
    ? Number(selectedVariant.price)
    : item.price
    ? Number(item.price)
    : 0;

  const discounted = getDiscountedPrice(rawPrice, activePromo, {
    productId: item.id || item._id,
    size: selectedVariant?.size || item.size,
  });

  return (
    <div
      className={`${styles.modalOverlay} ${
        isOpen && !isClosing ? styles.modalActive : ""
      } ${isClosing ? styles.modalClosing : ""}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-product-title"
    >
      <div
        className={styles.modalContentWrapper}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.modalCloseBtn}
          onClick={handleClose}
          aria-label={modalData?.accessibility?.closeAriaLabel || "Tutup Modal"}
        >
          <AppIcon name="x" className={styles.closeIcon} />
        </button>

        <div className={styles.modalGrid}>
          {/* Sisi Kiri: Gambar Produk */}
          <div className={styles.modalImageBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizeCloudinaryUrl(
                displayedImage,
                IMAGE_PRESETS.PRODUCT_DETAIL
              )}
              alt={item.name}
              className={styles.modalMainImg}
            />
          </div>

          {/* Sisi Kanan: Detail & Aksi */}
          <div className={styles.modalInfoBox}>
            <span className={styles.modalCategoryTag}>
              {item.category || "Artisanal Parfum"}
            </span>
            <h2 id="modal-product-title" className={styles.modalProductTitle}>
              {item.name}
            </h2>

            {/* Price Tag */}
            <div className={styles.modalPriceTag}>
              {rawPrice <= 0 ? (
                <span className={styles.modalPriceValue}>
                  {modalData?.labels?.outOfStock || "Stok Habis"}
                </span>
              ) : (
                <div className={styles.priceRow}>
                  {discounted.hasDiscount && (
                    <span className={styles.modalOriginalPrice}>
                      {formatRupiah(discounted.originalPrice)}
                    </span>
                  )}
                  <span className={styles.modalPriceValue}>
                    {formatRupiah(discounted.price)}
                  </span>
                  {discounted.hasDiscount && (
                    <span className={styles.modalDiscountBadge}>
                      Hemat {formatRupiah(discounted.savings)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <p className={styles.modalProductDesc}>
              {item.description || "Deskripsi produk kurasi Mameko."}
            </p>

            {/* Pilihan Varian */}
            {item.variants?.length > 0 && (
              <div className={styles.modalVariantSection}>
                <span className={styles.variantSectionTitle}>
                  {modalData?.labels?.variant || "Pilih Ukuran / Varian:"}
                </span>
                <div className={styles.variantPillGroup}>
                  {item.variants.map((v: any) => {
                    const stock = v.stock ?? 0;
                    const isOutOfStock = stock <= 0;
                    const isActive = currentSize === v.size;

                    return (
                      <label
                        key={v.size}
                        className={`${styles.variantPill} ${
                          isActive ? styles.pillActive : ""
                        } ${isOutOfStock ? styles.disabledPill : ""}`}
                      >
                        <input
                          type="radio"
                          name="modal-size"
                          value={v.size}
                          disabled={isOutOfStock}
                          checked={isActive}
                          onChange={() => handleSizeChange(v)}
                          className={styles.hiddenInput}
                        />
                        <div className={styles.variantPillContent}>
                          <span className={styles.variantSizeLabel}>
                            {v.size}
                          </span>
                          <span className={styles.variantStockText}>
                            {isOutOfStock
                              ? modalData?.labels?.soldOut || "Habis"
                              : `${
                                  modalData?.labels?.stockPrefix || "Stok: "
                                }${stock}`}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Row: Qty Controller & Buttons */}
            <div className={styles.modalActionRow}>
              <div className={styles.modalQtyBox}>
                <button
                  type="button"
                  className={styles.modalQtyBtn}
                  onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                  disabled={!selectedVariant || modalQty <= 1}
                  aria-label="Kurangi jumlah pesanan"
                >
                  <AppIcon name="minus" size={14} />
                </button>
                <span className={styles.modalQtyValue}>{modalQty}</span>
                <button
                  type="button"
                  className={styles.modalQtyBtn}
                  onClick={() =>
                    setModalQty(
                      Math.min(selectedVariant?.stock ?? 1, modalQty + 1)
                    )
                  }
                  disabled={
                    !selectedVariant ||
                    modalQty >= (selectedVariant?.stock ?? 1)
                  }
                  aria-label="Tambah jumlah pesanan"
                >
                  <AppIcon name="plus" size={14} />
                </button>
              </div>

              <button
                type="button"
                className={styles.modalAddToCartBtn}
                onClick={handleAddToCart}
                disabled={!selectedVariant}
              >
                <AppIcon name="shopping-bag" size={18} />
                <span>
                  {selectedVariant
                    ? modalData?.labels?.addToCart || "Masukkan ke Keranjang"
                    : modalData?.labels?.outOfStock || "Stok Habis"}
                </span>
              </button>

              {onTanyaProduk && (
                <button
                  type="button"
                  className={styles.modalChatBtn}
                  onClick={() => onTanyaProduk(item)}
                  title={modalData?.labels?.chatSeller || "Tanya Produk"}
                  aria-label={modalData?.labels?.chatSeller || "Tanya Produk"}
                >
                  <AppIcon name="message-circle" size={17} />
                  <span>{modalData?.labels?.chatSeller || "Tanya"}</span>
                </button>
              )}
            </div>

            {/* Reviews Section */}
            <div className={styles.reviewsSection}>
              <h3 className={styles.reviewsTitle}>
                {modalData?.reviews?.title || "Ulasan Pembeli"}
              </h3>
              {loadingReviews ? (
                <p className={styles.noReviews}>
                  {modalData?.reviews?.loading || "Memuat ulasan..."}
                </p>
              ) : reviews.length > 0 ? (
                <div className={styles.reviewList}>
                  {reviews.map((rev) => (
                    <div key={rev.id} className={styles.reviewItem}>
                      <div className={styles.reviewHeader}>
                        <span className={styles.reviewUser}>
                          {rev.userName ||
                            modalData?.labels?.customer ||
                            "Pelanggan"}
                        </span>
                        <span className={styles.reviewDate}>
                          {new Date(rev.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className={styles.reviewStars}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <AppIcon
                            key={i}
                            name="star"
                            size={13}
                            className={
                              i < rev.rating
                                ? styles.starFilled
                                : styles.starEmpty
                            }
                          />
                        ))}
                      </div>
                      <p className={styles.reviewComment}>{rev.comment}</p>
                      {rev.reviewPhoto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={optimizeCloudinaryUrl(
                            rev.reviewPhoto,
                            IMAGE_PRESETS.THUMBNAIL
                          )}
                          alt="Foto Ulasan"
                          className={styles.reviewImage}
                        />
                      )}
                    </div>
                  ))}
                  {hasMoreReviews && (
                    <button
                      type="button"
                      className={styles.loadMoreReviewsBtn}
                      onClick={handleLoadMoreReviews}
                      disabled={loadingReviews}
                    >
                      {loadingReviews
                        ? modalData?.reviews?.loadingMore || "Memuat..."
                        : modalData?.reviews?.loadMore ||
                          "Muat Lebih Banyak Ulasan"}
                    </button>
                  )}
                </div>
              ) : (
                <p className={styles.noReviews}>
                  {modalData?.reviews?.empty ||
                    "Belum ada ulasan untuk produk ini."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
