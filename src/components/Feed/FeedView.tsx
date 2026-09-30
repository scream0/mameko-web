// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import styles from "./FeedView.module.css";
import FeedCard from "./FeedCard";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { getApiBaseUrl } from "@/lib/apiClient";
import { auth } from "@/lib/supabaseClient";
import feedConfig from "@/data/ui/feedConfig.json";

export default function FeedView() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "saved">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchFeedPosts = async () => {
    try {
      const { data: { session } } = await auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${getApiBaseUrl()}/api/feed`, {
        headers,
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : [];
        setPosts(list);
      }
    } catch (err) {
      console.warn("Failed to load feed posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedPosts();
  }, []);

  const handleToggleLike = async (postId: string) => {
    const { data: { session } } = await auth.getSession();
    if (!session?.access_token) {
      toast.error(feedConfig.toasts.requireLogin);
      throw new Error("Require login");
    }

    const res = await fetch(`${getApiBaseUrl()}/api/feed/${postId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.is_liked) {
        toast.success(feedConfig.toasts.liked);
      } else {
        toast.success(feedConfig.toasts.unliked);
      }
    } else {
      throw new Error("Failed to like post");
    }
  };

  const handleToggleBookmark = async (postId: string) => {
    const { data: { session } } = await auth.getSession();
    if (!session?.access_token) {
      toast.error(feedConfig.toasts.requireLogin);
      throw new Error("Require login");
    }

    const res = await fetch(`${getApiBaseUrl()}/api/feed/${postId}/bookmark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.is_saved) {
        toast.success(feedConfig.toasts.saved);
      } else {
        toast.success(feedConfig.toasts.unsaved);
      }
    } else {
      throw new Error("Failed to bookmark post");
    }
  };

  const filteredPosts = useMemo(() => {
    let list = posts;
    if (activeTab === "saved") {
      list = list.filter((p) => Boolean(p.is_saved));
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.content || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.product?.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [posts, activeTab, searchQuery]);

  return (
    <div className={styles.feedContainer}>
      {/* 1. Header */}
      <div className={styles.feedHeader}>
        <span className={styles.tagline}>{feedConfig.header.tagline}</span>
        <h1 className={styles.title}>{feedConfig.header.title}</h1>
        <p className={styles.subtitle}>{feedConfig.header.subtitle}</p>
      </div>

      {/* 2. Control Bar */}
      <div className={styles.controlBar}>
        <div className={styles.tabsGroup}>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`${styles.tabBtn} ${activeTab === "all" ? styles.tabBtnActive : ""}`}
          >
            {feedConfig.nav.allPosts}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`${styles.tabBtn} ${activeTab === "saved" ? styles.tabBtnActive : ""}`}
          >
            {feedConfig.nav.savedPosts}
          </button>
        </div>

        <div className={styles.searchBox}>
          <AppIcon name="search" size={17} color="var(--text-secondary)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={feedConfig.search.placeholder}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className={styles.clearSearchBtn}
              aria-label={feedConfig.search.clearAria}
            >
              <AppIcon name="x" size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Feed List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
          Memuat cerita komunitas...
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyEmoji}>
            {activeTab === "saved" ? "🔖" : "✨"}
          </div>
          <div className={styles.emptyTitle}>
            {activeTab === "saved"
              ? feedConfig.emptyState.savedTitle
              : feedConfig.emptyState.allTitle}
          </div>
          <p className={styles.emptyDesc}>
            {activeTab === "saved"
              ? feedConfig.emptyState.savedDesc
              : feedConfig.emptyState.allDesc}
          </p>
        </div>
      ) : (
        <div className={styles.feedList}>
          {filteredPosts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              onToggleLike={handleToggleLike}
              onToggleBookmark={handleToggleBookmark}
              onOpenZoom={(url) => setZoomedImage(url)}
            />
          ))}
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className={styles.zoomOverlay} onClick={() => setZoomedImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomedImage} alt="Preview Foto" className={styles.zoomImg} />
        </div>
      )}
    </div>
  );
}
