"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { getApiBaseUrl } from "@/lib/apiClient";
import type { MaintenanceServerDetails } from "./MaintenanceView";
import toast from "react-hot-toast";
import maintenanceConfig from "@/data/ui/maintenanceConfig.json";

const MaintenanceView = dynamic(
  () => import("./MaintenanceView").then((mod) => mod.MaintenanceView),
  { ssr: false }
);

const DEFAULT_POLL_INTERVAL = 15; // Detik antar pengecekan status server

interface MaintenanceGuardProps {
  children: ReactNode;
}

export function MaintenanceGuard({ children }: MaintenanceGuardProps) {
  // Flag statis dari environment variable (Cloudflare Pages kill-switch)
  const isEnvMaintenance =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true" ||
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "1";

  const [isMaintenance, setIsMaintenance] = useState<boolean>(isEnvMaintenance);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(DEFAULT_POLL_INTERVAL);
  const [isBypassed, setIsBypassed] = useState<boolean>(false);
  const [maintenanceDetails, setMaintenanceDetails] =
    useState<MaintenanceServerDetails | null>(null);

  // Simpan ref ke interval countdown
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Periksa apakah user memiliki akses bypass admin
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedBypass = window.sessionStorage.getItem("mameko_admin_bypass");
      if (savedBypass === "true") {
        setIsBypassed(true);
        return;
      }

      // Auto-bypass untuk Administrator yang sudah login
      const rawUser =
        window.sessionStorage.getItem("mameko_user") ||
        window.localStorage.getItem("mameko_user");
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser);
          const role =
            user?.role ||
            user?.app_metadata?.role ||
            user?.user_metadata?.role;
          if (role === "admin" || role === "superadmin") {
            window.sessionStorage.setItem("mameko_admin_bypass", "true");
            setIsBypassed(true);
            return;
          }
        } catch {
          // Abaikan kesalahan parse JSON
        }
      }
    } catch (e) {
      console.warn("Unable to check admin bypass token:", e);
    }
  }, []);

  // Fungsi pengecekan status server ke /api/health
  const checkServerHealth = useCallback(async (): Promise<boolean> => {
    if (isEnvMaintenance) {
      // Jika environment flag dipaksa aktif, tetap maintenance
      return false;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return true;
    }

    try {
      setIsChecking(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/health`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Status 502, 503, 504 mengindikasikan server sedang update / restart
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        return false;
      }

      const data = res.headers.get("content-type")?.includes("application/json")
        ? await res.json()
        : null;

      // Cek apakah response sehat
      if (res.ok && data) {
        const isDbHealthy =
          data.database === "healthy" || data.status === "success";
        const isServerMaintenance = Boolean(data.maintenance);

        if (isServerMaintenance) {
          if (data.maintenance_details) {
            setMaintenanceDetails(data.maintenance_details);
          }
          return false;
        }

        if (isDbHealthy) {
          setMaintenanceDetails(null);
          return true;
        }
      }

      return false;
    } catch {
      // Saat perangkat offline (PWA offline mode), jangan anggap sebagai server maintenance
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return true;
      }
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [isEnvMaintenance]);

  // Listener untuk trigger maintenance dari apiClient saat request runtime gagal (502/503)
  useEffect(() => {
    if (isBypassed) return;

    const handleMaintenanceEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ statusCode?: number }>;
      const code = customEvent.detail?.statusCode;

      if (code === 502 || code === 503 || code === 504) {
        setIsMaintenance(true);
        setCountdown(DEFAULT_POLL_INTERVAL);
      }
    };

    window.addEventListener("mameko-server-maintenance", handleMaintenanceEvent);

    return () => {
      window.removeEventListener(
        "mameko-server-maintenance",
        handleMaintenanceEvent
      );
    };
  }, [isBypassed]);

  // Initial check on mount jika tidak dipaksa oleh environment
  useEffect(() => {
    if (isBypassed) return;

    if (!isEnvMaintenance) {
      checkServerHealth().then((isHealthy) => {
        if (!isHealthy) {
          setIsMaintenance(true);
        }
      });
    }
  }, [checkServerHealth, isEnvMaintenance, isBypassed]);

  // Countdown loop saat berada dalam kondisi maintenance
  useEffect(() => {
    if (!isMaintenance || isBypassed) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Waktu hitung mundur habis: periksa ulang status server
          checkServerHealth().then((isHealthy) => {
            if (isHealthy) {
              setIsMaintenance(false);
              toast.success(maintenanceConfig.timer.healthySuccess);
            } else {
              setCountdown(DEFAULT_POLL_INTERVAL);
            }
          });
          return DEFAULT_POLL_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isMaintenance, isBypassed, checkServerHealth]);

  // Manual trigger "Periksa Status Server" oleh user
  const handleCheckNow = async () => {
    const isHealthy = await checkServerHealth();
    if (isHealthy) {
      setIsMaintenance(false);
      toast.success(maintenanceConfig.timer.healthySuccess);
    } else {
      setCountdown(DEFAULT_POLL_INTERVAL);
      toast(maintenanceConfig.timer.checkingText, {
        icon: "⏳",
      });
    }
  };

  // Jika sedang maintenance dan bukan bypass admin: tampilkan MaintenanceView eksklusif
  if (isMaintenance && !isBypassed) {
    return (
      <MaintenanceView
        countdown={countdown}
        isChecking={isChecking}
        onCheckNow={handleCheckNow}
        details={maintenanceDetails}
        onAdminBypassSuccess={() => setIsBypassed(true)}
      />
    );
  }

  // Kondisi normal: render aplikasi lengkap
  return <>{children}</>;
}

