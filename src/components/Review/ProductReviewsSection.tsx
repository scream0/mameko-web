// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import styles from "./ProductReviewsSection.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { getApiBaseUrl } from "@/lib/apiClient";
import { auth } from "@/lib/supabaseClient";
import reviewConfig from "@/data/ui/productReviewsConfig.json";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";

interface ProductReviewsSectionProps {
  productId: string;
}

export default function ProductReviewsSection({ productId }: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchReviews = async () => {
    if (!productId) return;
    try {
      const { data: { session } } = await auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${getApiBaseUrl()}/api/reviews?productId=${productId}`, {
        headers,
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.reviews)
          ? json.reviews
          : Array.isArray(json.data)
          ? json.data
          : [];
        setReviews(list);
      }
    } catch (err) {
      console.warn("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const stats = useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return { avgRating: 5.0, count: 0 };
    }
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    const avg = Math.round((sum / reviews.length) * 10) / 10;
    return { avgRating: avg, count: reviews.length };
  }, [reviews]);

  const handleToggleHelpful = async (reviewId: string) => {
    try {
      const { data: { session } } = await auth.getSession();
      if (!session?.access_token) {
        toast.error(reviewConfig.helpful.loginRequired);
        return;
      }

      setVotingId(reviewId);

      // Optimistic update
      setReviews((prev) =>
        prev.map((r) => {
          if (String(r.id) === String(reviewId)) {
            const wasHelpful = Boolean(r.is_helpful);
            const currentCount = Number(r.helpful_count) || 0;
            return {
              ...r,
              is_helpful: !wasHelpful,
              helpful_count: wasHelpful ? Math.max(0, currentCount - 1) : currentCount + 1,
            };
          }
          return r;
        })
      );

      const res = await fetch(`${getApiBaseUrl()}/api/reviews/${reviewId}/helpful`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.is_helpful) {
          toast.success(reviewConfig.helpful.votedSuccess);
        } else {
          toast.success(reviewConfig.helpful.unvotedSuccess);
        }
      } else {
        // Revert on failure
        fetchReviews();
      }
    } catch (err) {
      console.error("Helpful toggle error:", err);
      fetchReviews();
    } finally {
      setVotingId(null);
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const num = Math.round(Number(rating) || 5);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} style={{ color: i <= num ? "#f59e0b" : "#d1d5db" }}>
          ★
        </span>
      );
    }
    return <div className={styles.starGroup}>{stars}</div>;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <section className={styles.reviewsWrapper}>
      <div className={styles.reviewsHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{reviewConfig.header.title}</h2>
          <span className={styles.totalReviewsText}>
            {stats.count} {reviewConfig.header.reviewsCount}
          </span>
        </div>

        {stats.count > 0 && (
          <div className={styles.ratingSummaryCard}>
            <div className={styles.avgRatingNum}>{stats.avgRating.toFixed(1)}</div>
            <div className={styles.avgRatingInfo}>
              {renderStars(stats.avgRating)}
              <span className={styles.totalReviewsText}>
                {stats.avgRating.toFixed(1)} {reviewConfig.stats.outOf}
              </span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
          Memuat ulasan...
        </div>
      ) : reviews.length === 0 ? (
        <div className={styles.emptyReviewsCard}>
          <div className={styles.emptyIcon}>💬</div>
          <div className={styles.emptyTitle}>{reviewConfig.emptyState.title}</div>
          <p>{reviewConfig.emptyState.description}</p>
        </div>
      ) : (
        <div className={styles.reviewList}>
          {reviews.map((r: any) => {
            const initial = String(r.user_name || "U")[0].toUpperCase();
            const isHelpful = Boolean(r.is_helpful);
            const helpfulCount = Number(r.helpful_count) || 0;

            return (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewUserRow}>
                  <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>{initial}</div>
                    <div>
                      <div className={styles.userName}>{r.user_name || "Pelanggan Mameko"}</div>
                      <div className={styles.reviewDate}>{formatDate(r.created_at)}</div>
                    </div>
                  </div>
                  <div className={styles.reviewRatingRow}>
                    {renderStars(r.rating)}
                  </div>
                </div>

                {r.comment && (
                  <p className={styles.reviewComment}>{r.comment}</p>
                )}

                {r.review_photo && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={optimizeCloudinaryUrl(r.review_photo, IMAGE_PRESETS.THUMBNAIL)}
                      alt="Foto Ulasan"
                      className={styles.reviewPhotoThumb}
                      onClick={() => setZoomedImage(r.review_photo)}
                    />
                  </div>
                )}

                <div className={styles.reviewActionsRow}>
                  <button
                    type="button"
                    disabled={votingId === r.id}
                    onClick={() => handleToggleHelpful(r.id)}
                    className={`${styles.helpfulBtn} ${isHelpful ? styles.helpfulBtnActive : ""}`}
                    aria-label={reviewConfig.helpful.buttonLabel}
                  >
                    <span>👍</span>
                    <span>
                      {reviewConfig.helpful.buttonLabel}
                      {helpfulCount > 0 ? ` (${helpfulCount})` : ""}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setZoomedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImage}
            alt="Preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", objectFit: "contain" }}
          />
        </div>
      )}
    </section>
  );
}
