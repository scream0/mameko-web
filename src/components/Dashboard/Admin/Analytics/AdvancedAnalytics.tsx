// @ts-nocheck
"use client";
import { getApiBaseUrl } from "@/lib/apiClient";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./AdvancedAnalytics.module.css";

// Import Konfigurasi JSON
import config from "@/data/ui/advancedAnalyticsConfig.json";
import { auth } from "@/lib/supabaseClient";

const COLORS = config.chartPalette || ["#d4af37", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

const FALLBACK_STATUS = [{ name: config.fallbacks?.completed || "Selesai", value: 100 }];
const FALLBACK_VARIANTS = [{ name: config.fallbacks?.noOrders || "Belum ada pesanan", sold: 0 }];

export default function AdvancedAnalytics() {
  const [metrics, setMetrics] = useState({
    momGrowth: 0,
    currentMonthRev: 0,
    lastMonthRev: 0,
  });
  const [variantData, setVariantData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper aman untuk mengambil tanggal & harga dari berbagai struktur API
  const getOrderDate = (order: any) => {
    const dateField = order.createdAt || order.created_at || order.date;
    return dateField ? new Date(dateField) : null;
  };

  const getOrderAmount = (order: any) => {
    return Number(
      order.price || order.total || order.total_price || order.total_amount || order.gross_amount || order.amount || 0,
    );
  };

  const processMoMGrowth = useCallback((orders: any) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let currentRev = 0;
    let lastRev = 0;

    orders.forEach((order: any) => {
      const d = getOrderDate(order);
      const amount = getOrderAmount(order);

      if (d) {
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          currentRev += amount;
        } else if (
          d.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1) &&
          d.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear)
        ) {
          lastRev += amount;
        }
      }
    });

    let growth = 0;
    if (lastRev > 0) {
      growth = ((currentRev - lastRev) / lastRev) * 100;
    } else if (currentRev > 0) {
      growth = 100;
    }

    setMetrics({
      momGrowth: Number(growth.toFixed(1)),
      currentMonthRev: currentRev,
      lastMonthRev: lastRev,
    });
  }, []);

  const processStatusDistribution = useCallback((orders: any) => {
    const statusCounts: Record<string, number> = {};

    orders.forEach((order: any) => {
      let rawStatus = order.status || order.order_status || order.orderStatus || "pending";
      rawStatus = String(rawStatus).toLowerCase();

      let label = config.statusLabels[rawStatus] || rawStatus;
      label = label ? String(label).charAt(0).toUpperCase() + String(label).slice(1) : "";

      statusCounts[label] = (statusCounts[label] || 0) + 1;
    });

    const formatted = Object.keys(statusCounts).map((k) => ({
      name: k,
      value: statusCounts[k],
    }));

    setStatusData(formatted.length > 0 ? formatted : FALLBACK_STATUS);
  }, []);

  const processTopVariants = useCallback((orders: any) => {
    const variantMap: Record<string, number> = {};

    orders.forEach((order: any) => {
      let rawItems = order.items;
      if (typeof rawItems === "string") {
        try {
          rawItems = JSON.parse(rawItems);
        } catch {
          rawItems = [];
        }
      }

      if (Array.isArray(rawItems)) {
        rawItems.forEach((item: any) => {
          const prodName =
            item.title ||
            item.product_name ||
            item.productName ||
            item.name ||
            config.labels.defaultVariantName;
          const variantName =
            item.variant ||
            item.size ||
            item.variant_name ||
            item.variantName ||
            config.labels.defaultVariantSize;
          const key = `${prodName} (${variantName})`;
          const qty = Number(item.qty || item.quantity || 1);

          variantMap[key] = (variantMap[key] || 0) + qty;
        });
      }
    });

    const formatted =
      Object.keys(variantMap).length > 0
        ? Object.keys(variantMap).map((k) => ({ name: k, sold: variantMap[k] }))
        : FALLBACK_VARIANTS;

    setVariantData(formatted.sort((a, b) => b.sold - a.sold).slice(0, 5));
  }, []);

  const processInventoryTurnover = useCallback((products: any) => {
    const report = [];

    products.forEach((prod: any) => {
      if (prod.variants && Array.isArray(prod.variants)) {
        prod.variants.forEach((v: any) => {
          const totalStock = Number(v.stock || 0);
          const isFast = totalStock <= 10;
          report.push({
            name: `${prod.name} - ${v.size}`,
            stock: totalStock,
            turnover: isFast
              ? config.inventory.turnoverLevels.fast
              : config.inventory.turnoverLevels.normal,
            recommendation: isFast
              ? config.inventory.recommendations.restock
              : config.inventory.recommendations.safe,
          });
        });
      }
    });

    setInventoryList(report.slice(0, 5));
  }, []);

  useEffect(() => {
    const fetchAdvancedData = async () => {
      try {
        const { data: { session } } = await auth.getSession();
        const token = session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [ordersRes, productsRes] = await Promise.all([
          fetch(getApiBaseUrl() + "/api/admin/orders?limit=1000", { headers }),
          fetch(getApiBaseUrl() + "/api/products?limit=1000", { headers }),
        ]);

        const ordersResult = (ordersRes.headers?.get("content-type")?.includes("application/json") ? await ordersRes.json() : {});
        const productsResult = (productsRes.headers?.get("content-type")?.includes("application/json") ? await productsRes.json() : {});

        const orders = Array.isArray(ordersResult)
          ? ordersResult
          : ordersResult.data || ordersResult.orders || [];

        const products = Array.isArray(productsResult)
          ? productsResult
          : productsResult.data || productsResult.products || [];

        processMoMGrowth(orders);
        processStatusDistribution(orders);
        processTopVariants(orders);
        processInventoryTurnover(products);
      } catch (err) {
        console.error("Gagal memuat analitik lanjutan:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdvancedData();
  }, [
    processMoMGrowth,
    processStatusDistribution,
    processTopVariants,
    processInventoryTurnover,
  ]);

  if (loading) return null;

  const activePieData = statusData.length > 0 ? statusData : FALLBACK_STATUS;

  return (
    <div className={styles.advancedContainer}>
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>{config.sections.growthRate}</span>
          <span className={styles.metricValue}>
            {metrics.momGrowth >= 0 ? `+${metrics.momGrowth}%` : `${metrics.momGrowth}%`}
          </span>
          <span
            className={`${styles.metricTrend} ${
              metrics.momGrowth >= 0 ? styles.trendPositive : styles.trendNegative
            }`}
          >
            {metrics.momGrowth >= 0
              ? config.labels.trendUp
              : config.labels.trendDown}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>
            {config.labels.currentMonthLabel}
          </span>
          <span className={styles.metricValue}>
            {config.currencyPrefix}{metrics.currentMonthRev.toLocaleString("id-ID")}
          </span>
          <span className={`${styles.metricTrend} ${styles.trendNeutral}`}>
            {config.labels.lastMonthPrefix}
            {metrics.lastMonthRev.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h4 className={styles.cardTitle}>{config.sections.topVariants}</h4>
          <div className={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={variantData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--text-secondary)"
                  fontSize={11}
                  width={130}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-primary)",
                    borderColor: "var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    padding: "10px 14px",
                  }}
                  itemStyle={{ color: "var(--primary-accent, #fbbf24)", fontWeight: 600 }}
                  formatter={(value) => [
                    `${value} ${config.labels.unitsSold}`,
                    config.labels.soldTooltip,
                  ]}
                />
                <Bar dataKey="sold" fill="var(--primary-accent, #fbbf24)" radius={[0, 6, 6, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h4 className={styles.cardTitle}>{config.sections.orderStatus}</h4>
          <div className={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <Pie
                  data={activePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {activePieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="var(--surface-primary)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-primary)",
                    borderColor: "var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    padding: "10px 14px",
                  }}
                  itemStyle={{ color: "var(--primary-accent, #fbbf24)", fontWeight: 600 }}
                  formatter={(value) => [
                    `${value} ${config.labels.ordersCount}`,
                    config.labels.jumlahTooltip,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <h4 className={styles.cardTitle}>
          {config.sections.inventoryMovement}
        </h4>
        <div className={styles.tableWrapper}>
          <table className={styles.inventoryTable}>
            <thead>
              <tr>
                <th>{config.headers.productName}</th>
                <th>{config.headers.remainingStock}</th>
                <th>{config.headers.status}</th>
                <th>{config.headers.action}</th>
              </tr>
            </thead>
            <tbody>
              {inventoryList.length > 0 ? (
                inventoryList.map((item, idx) => (
                  <tr key={idx}>
                    <td className={styles.tableItemName}>{item.name}</td>
                    <td>{item.stock} {config.units.pcs}</td>
                    <td>
                      <span
                        className={
                          item.turnover === config.inventory.turnoverLevels.fast
                            ? styles.badgeFast
                            : styles.badgeSlow
                        }
                      >
                        {item.turnover}
                      </span>
                    </td>
                    <td>{item.recommendation}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className={styles.emptyTableText}>
                    {config.labels.emptyInventory}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}