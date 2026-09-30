// @ts-nocheck
"use client";

import React, { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import styles from "./FeedCard.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import feedConfig from "@/data/ui/feedConfig.json";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";

interface FeedCardProps {
  post: any;
  onToggleLike: (postId: string) => Promise<void>;
  onToggleBookmark: (postId: string) => Promise<void>;
  onOpenZoom: (url: string) => void;
}

export default function FeedCard({
  post,
  onToggleLike,
  onToggleBookmark,
  onOpenZoom,
}: FeedCardProps) {
  const [likeCount, setLikeCount] = useState(Number(post.like_count) || 0);
  const [isLiked, setIsLiked] = useState(Boolean(post.is_liked));
  const [saveCount, setSaveCount] = useState(Number(post.save_count) || 0);
  const [isSaved, setIsSaved] = useState(Boolean(post.is_saved));
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    const prevLiked = isLiked;
    const prevCount = likeCount;

    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      await onToggleLike(post.id);
    } catch {
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleBookmark = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const prevSaved = isSaved;
    const prevCount = saveCount;

    setIsSaved(!prevSaved);
    setSaveCount(prevSaved ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      await onToggleBookmark(post.id);
    } catch {
      setIsSaved(prevSaved);
      setSaveCount(prevCount);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/feed#post-${post.id}` : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.content,
          url,
        });
      } catch {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        toast.success(feedConfig.toasts.shareCopied);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(feedConfig.toasts.shareCopied);
      } catch {
        toast.error(feedConfig.toasts.shareFailed);
      }
    }
  };

  const formatRelativeTime = (timeStr?: string) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return timeStr;
    }
  };

  const formatRupiah = (val: number) => {
    return `Rp ${Number(val).toLocaleString("id-ID")}`;
  };

  const initial = String(post.author_name || "M")[0].toUpperCase();
  const isOfficial = post.author_role === "admin" || post.author_role === "superadmin" || post.author_role === "official";

  const images = Array.isArray(post.image_urls) ? post.image_urls : [];
  const product = post.product;
  const productPrice = product?.variants?.[0]?.price || product?.price || 0;

  return (
    <article className={styles.feedCard} id={`post-${post.id}`}>
      {/* 1. Author Row */}
      <div className={styles.authorRow}>
        <div className={styles.authorMeta}>
          <div className={styles.avatar}>
            {post.author_avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={optimizeCloudinaryUrl(post.author_avatar, IMAGE_PRESETS.AVATAR)}
                alt={post.author_name}
                className={styles.avatarImg}
              />
            ) : (
              initial
            )}
          </div>
          <div className={styles.authorDetails}>
            <div className={styles.nameRow}>
              <span className={styles.authorName}>{post.author_name || "Mameko Member"}</span>
              <span
                className={`${styles.roleBadge} ${
                  isOfficial ? styles.roleOfficial : styles.roleCollector
                }`}
              >
                {isOfficial
                  ? feedConfig.card.authorOfficial
                  : feedConfig.card.authorCollector}
              </span>
            </div>
            <span className={styles.postTime}>{formatRelativeTime(post.created_at)}</span>
          </div>
        </div>

        {post.category && (
          <span className={styles.categoryTag}>{post.category}</span>
        )}
      </div>

      {/* 2. Title & Content */}
      {post.title && <h2 className={styles.postTitle}>{post.title}</h2>}
      {post.content && <p className={styles.postBody}>{post.content}</p>}

      {/* 3. Fragrance Notes Badge if applicable */}
      {(post.top_notes || post.mid_notes || post.base_notes) && (
        <div className={styles.notesRow}>
          {post.top_notes && <span className={styles.notePill}>Top: {post.top_notes}</span>}
          {post.mid_notes && <span className={styles.notePill}>Mid: {post.mid_notes}</span>}
          {post.base_notes && <span className={styles.notePill}>Base: {post.base_notes}</span>}
        </div>
      )}

      {/* 4. Gallery Images */}
      {images.length > 0 && (
        <div className={styles.galleryGrid}>
          {images.map((imgUrl: string, idx: number) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={idx}
              src={optimizeCloudinaryUrl(imgUrl, IMAGE_PRESETS.PRODUCT_GRID)}
              alt={post.title || "Foto Komunitas"}
              className={styles.galleryItem}
              onClick={() => onOpenZoom(imgUrl)}
            />
          ))}
        </div>
      )}

      {/* 5. Linked Product Card */}
      {product && product.id && (
        <Link href={`/product?id=${product.id}`} className={styles.linkedProductCard}>
          <div className={styles.productThumbInfo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizeCloudinaryUrl(product.image_url || "/placeholder.jpg", IMAGE_PRESETS.THUMBNAIL)}
              alt={product.name}
              className={styles.productThumb}
            />
            <div className={styles.productText}>
              <span className={styles.productName}>{product.name}</span>
              {productPrice > 0 && (
                <span className={styles.productPrice}>{formatRupiah(productPrice)}</span>
              )}
            </div>
          </div>
          <div className={styles.viewProductBtn}>
            <span>{feedConfig.card.viewProductBtn}</span>
            <AppIcon name="arrow-right" size={14} />
          </div>
        </Link>
      )}

      {/* 6. Action Bar (Likes, Bookmarks, Share) */}
      <div className={styles.actionBar}>
        <div className={styles.actionGroup}>
          <button
            type="button"
            onClick={handleLike}
            disabled={isLiking}
            className={`${styles.actionBtn} ${isLiked ? styles.likedActive : ""}`}
            aria-label={feedConfig.card.likeAria}
          >
            <span>{isLiked ? "❤️" : "🤍"}</span>
            <span>{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={handleBookmark}
            disabled={isSaving}
            className={`${styles.actionBtn} ${isSaved ? styles.bookmarkedActive : ""}`}
            aria-label={feedConfig.card.bookmarkAria}
          >
            <span>{isSaved ? "🔖" : "🏷️"}</span>
            <span>{saveCount}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className={styles.actionBtn}
          aria-label={feedConfig.card.shareAria}
        >
          <AppIcon name="share-2" size={15} />
        </button>
      </div>
    </article>
  );
}
