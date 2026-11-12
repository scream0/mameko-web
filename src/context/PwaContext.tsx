"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import toast from "react-hot-toast";
import pwaConfig from "@/data/ui/pwaConfig.json";
import styles from "@/components/PWA/PwaComponents.module.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaContextValue {
  isOnline: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isInstalling: boolean;
  triggerInstall: () => Promise<void>;
}

const PwaContext = createContext<PwaContextValue>({
  isOnline: true,
  isStandalone: false,
  canInstall: false,
  isInstalling: false,
  triggerInstall: async () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [supportsWebInstall, setSupportsWebInstall] = useState(false);
  const [hasDeferredPrompt, setHasDeferredPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const computeStandalone = () =>
      standaloneQuery.matches || Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    setIsStandalone(computeStandalone());

    const webInstallSupported =
      typeof (Navigator.prototype as unknown as { install?: unknown }).install === "function";
    setSupportsWebInstall(webInstallSupported);

    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("PWA service worker registration skipped:", err);
        });
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setHasDeferredPrompt(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setHasDeferredPrompt(false);
      setIsStandalone(true);
      toast.success(pwaConfig.install.installedSuccess);
    };

    const handleDisplayModeChange = () => {
      setIsStandalone(computeStandalone());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (isInstalling || isStandalone) return;
    const navWithInstall = navigator as Navigator & { install?: () => Promise<void> };
    const hasNativeInstall = typeof navWithInstall.install === "function";
    const promptEvent = deferredPromptRef.current;

    if (!hasNativeInstall && !promptEvent) {
      return;
    }

    setIsInstalling(true);
    try {
      if (hasNativeInstall && navWithInstall.install) {
        await navWithInstall.install();
        toast.success(pwaConfig.install.installedSuccess);
      } else if (promptEvent) {
        deferredPromptRef.current = null;
        setHasDeferredPrompt(false);
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") {
          toast.success(pwaConfig.install.installedSuccess);
        } else {
          toast(pwaConfig.install.cancelled);
        }
      }
    } catch (error: unknown) {
      const errName = error instanceof Error ? error.name : "";
      if (errName === "AbortError") {
        toast(pwaConfig.install.cancelled);
      } else {
        console.error("PWA install error:", error);
        toast.error(pwaConfig.install.failed);
      }
    } finally {
      setIsInstalling(false);
    }
  }, [isInstalling, isStandalone]);

  const canInstall = !isStandalone && (supportsWebInstall || hasDeferredPrompt);

  return (
    <PwaContext.Provider value={{ isOnline, isStandalone, canInstall, isInstalling, triggerInstall }}>
      {!isOnline && (
        <div className={styles.offlineBanner} role="status" aria-live="polite">
          <span className={styles.offlineDot} aria-hidden="true" />
          <span className={styles.offlineText}>
            <strong>{pwaConfig.offlineBanner.title}</strong> — {pwaConfig.offlineBanner.description}
          </span>
        </div>
      )}
      {children}
    </PwaContext.Provider>
  );
}

