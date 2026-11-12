"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import styles from "./ProductReviewsSection.module.css";
import { getApiBaseUrl } from "@/lib/apiClient";
import { auth } from "@/lib/mamekoClient";
import reviewConfig from "@/data/ui/productReviewsConfig.json";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";
import {
  normalizeProductReview,
  extractHelpfulVoteResponse,
  type NormalizedProductReview,
} from "@/utils/reviewSync";

interface ProductReviewsSectionProps {
  productId: string;
}

export default function ProductReviewsSection({ productId }: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<NormalizedProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
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
        const rawList = Array.isArray(json.reviews)
          ? json.reviews
          : Array.isArray(json.data)
          ? json.data
          : [];
        setReviews(rawList.map(normalizeProductReview));
      }
    } catch (err) {
      console.warn("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        fetchReviews();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [fetchReviews]);

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

      // Optimistic update synced with backend camelCase fields
      setReviews((prev) =>
        prev.map((r) => {
          if (String(r.id) === String(reviewId)) {
            const wasHelpful = Boolean(r.isHelpful);
            const currentCount = Number(r.helpfulCount) || 0;
            return {
              ...r,
              isHelpful: !wasHelpful,
              helpfulCount: wasHelpful ? Math.max(0, currentCount - 1) : currentCount + 1,
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
        const serverVote = extractHelpfulVoteResponse(data);
        setReviews((prev) =>
          prev.map((r) =>
            String(r.id) === String(reviewId)
              ? {
                  ...r,
                  isHelpful: serverVote.isHelpful,
                  helpfulCount:
                    serverVote.helpfulCount !== null
                      ? serverVote.helpfulCount
                      : r.helpfulCount,
                }
              : r
          )
        );
        if (serverVote.isHelpful) {
          toast.success(reviewConfig.helpful.votedSuccess);
        } else {
          toast.success(reviewConfig.helpful.unvotedSuccess);
        }
      } else {
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
        <span key={i} className={i <= num ? styles.starFilled : styles.starMuted}>
          ★
        </span>
      );
    }
    return <div className={styles.starGroup}>{stars}</div>;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const parsed = new Date(dateStr);
      if (Number.isNaN(parsed.getTime())) return "";
      return parsed.toLocaleDateString("id-ID", {
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
        <div className={styles.loadingState}>
          {reviewConfig.states?.loading}
        </div>
      ) : reviews.length === 0 ? (
        <div className={styles.emptyReviewsCard}>
          <div className={styles.emptyIcon}>💬</div>
          <div className={styles.emptyTitle}>{reviewConfig.emptyState.title}</div>
          <p>{reviewConfig.emptyState.description}</p>
        </div>
      ) : (
        <div className={styles.reviewList}>
          {reviews.map((r) => {
            const displayName = r.userName || reviewConfig.header.defaultReviewer;
            const initial = displayName.charAt(0).toUpperCase();

            return (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewUserRow}>
                  <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>{initial}</div>
                    <div>
                      <div className={styles.userName}>{displayName}</div>
                      <div className={styles.reviewDate}>{formatDate(r.createdAt)}</div>
                    </div>
                  </div>
                  <div className={styles.reviewRatingRow}>
                    {renderStars(r.rating)}
                  </div>
                </div>

                {r.comment && (
                  <p className={styles.reviewComment}>{r.comment}</p>
                )}

                {r.reviewPhoto && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={optimizeCloudinaryUrl(r.reviewPhoto, IMAGE_PRESETS.THUMBNAIL)}
                      alt={reviewConfig.states?.photoAlt}
                      className={styles.reviewPhotoThumb}
                      onClick={() => setZoomedImage(r.reviewPhoto)}
                    />
                  </div>
                )}

                <div className={styles.reviewActionsRow}>
                  <button
                    type="button"
                    disabled={votingId === r.id}
                    onClick={() => handleToggleHelpful(r.id)}
                    className={`${styles.helpfulBtn} ${r.isHelpful ? styles.helpfulBtnActive : ""}`}
                    aria-label={reviewConfig.helpful.buttonLabel}
                  >
                    <span>👍</span>
                    <span>
                      {reviewConfig.helpful.buttonLabel}
                      {r.helpfulCount > 0 ? ` (${r.helpfulCount})` : ""}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoomedImage && (
        <div className={styles.zoomOverlay} onClick={() => setZoomedImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImage}
            alt={reviewConfig.states?.zoomAlt}
            className={styles.zoomImage}
          />
        </div>
      )}
    </section>
  );
}
