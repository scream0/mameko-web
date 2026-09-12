// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import styles from "./OverviewStats.module.css";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewConfig.json";
import { StatsSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { calculateDashboardStats } from "@/utils/dashboardSummary";
import { auth, supabase } from "@/lib/supabaseClient";

export default function OverviewStats() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeProducts: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Coba ambil ringkasan langsung dari endpoint server /api/admin/overview
      try {
        const overviewRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/overview", { headers });
        if (overviewRes.ok) {
          const overviewResult = await overviewRes.json();
          const d = overviewResult.data || overviewResult;
          if (d && (d.totalOrders !== undefined || d.total_orders !== undefined)) {
            setStats({
              totalRevenue: Number(d.totalRevenue ?? d.total_revenue ?? 0),
              totalOrders: Number(d.totalOrders ?? d.total_orders ?? 0),
              activeProducts: Number(d.activeProducts ?? d.active_products ?? 0),
              lowStockCount: Number(d.lowStockCount ?? d.low_stock_count ?? 0),
            });
            return;
          }
        }
      } catch {
        // Lanjut ke kalkulasi lokal via /api/products & /api/admin/orders jika overview server offline
      }

      // 2. Fallback: Hitung agregat lokal dari daftar produk dan pesanan
      const [res, ordersRes] = await Promise.all([
        fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/products?limit=200", { headers }),
        fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/orders?limit=1000", { headers }),
      ]);

      const productsResult = res.ok
        ? (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {})
        : {};
      const products = (productsResult.data || productsResult.products || []).filter(Boolean);

      const ordersResult = ordersRes.ok
        ? (ordersRes.headers?.get("content-type")?.includes("application/json") ? await ordersRes.json() : {})
        : {};
      const orders = (ordersResult.data || ordersResult.orders || []).filter(Boolean);

      const summary = calculateDashboardStats({ products, orders });
      setStats(summary);
    } catch (err: any) {
      console.error("OverviewStats fetch error:", err);
      toast.error(overviewConfig.toasts.statsLoadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Debounce timer for realtime updates
    let debounceTimer: NodeJS.Timeout;
    const triggerDebouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchDashboardData();
      }, 500);
    };

    const channel = supabase
      .channel("overview-stats-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => triggerDebouncedFetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => triggerDebouncedFetch()
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const formatRupiah = (number: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  if (loading) {
    return (
      <div className={styles.statsContainer}>
        <StatsSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className={styles.statsContainer}>
      {/* Stat Cards Grid */}
      <div className={styles.cardsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} aria-hidden="true">
            ↗
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.revenue}
            </span>
            <span className={styles.statValue}>
              {loading ? "..." : formatRupiah(stats.totalRevenue)}
            </span>
            <span className={styles.statDesc}>
              {overviewConfig.cardDescriptions.revenue}
            </span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} aria-hidden="true">
            ⌁
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.orders}
            </span>
            <span className={styles.statValue}>
              {loading ? "..." : stats.totalOrders}
            </span>
            <span className={styles.statDesc}>
              {overviewConfig.cardDescriptions.orders}
            </span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} aria-hidden="true">
            ◌
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.products}
            </span>
            <span className={styles.statValue}>
              {loading ? "..." : stats.activeProducts}
            </span>
            <span className={styles.statDesc}>
              {overviewConfig.cardDescriptions.products}
            </span>
          </div>
        </div>
        <div className={`${styles.statCard} ${stats.lowStockCount > 0 ? styles.statCardWarning : ""}`}>
          <div className={styles.statIcon} aria-hidden="true">
            !
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.lowStock}
            </span>
            <span
              className={`${styles.statValue} ${stats.lowStockCount > 0 ? styles.warningValue : ""}`}
            >
              {loading ? "..." : stats.lowStockCount}
            </span>
            <span
              className={`${styles.statDesc} ${stats.lowStockCount > 0 ? styles.warningDesc : ""}`}
            >
              {stats.lowStockCount > 0
                ? overviewConfig.cardDescriptions.lowStockWarning
                : overviewConfig.cardDescriptions.lowStockOk}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
