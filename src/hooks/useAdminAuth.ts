"use client";

import { getApiBaseUrl } from "@/lib/apiClient";
import { useEffect, useState } from "react";
import { auth } from "@/lib/mamekoClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";

export function useAdminAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState("");
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    let isDisposed = false;
    let activeController = null;

    const verifyAdmin = async (currentUser, accessToken) => {
      activeController?.abort();

      if (!currentUser) {
        if (!isDisposed) {
          window.location.replace("/login");
        }
        return;
      }

      const abortController = new AbortController();
      activeController = abortController;

      setUser(currentUser);
      setAccessError("");
      setLoading(true);

      try {
        const userId = currentUser.id || currentUser.uid;
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

        const sessionRole = String(currentUser.role || "").toLowerCase();
        if (sessionRole === "admin" || sessionRole === "superadmin") {
          setIsAdmin(true);
          setRole(sessionRole);
        }

        const res = await fetch(getApiBaseUrl() + `/api/user/profile`, {
          headers,
          signal: abortController.signal,
        });

        if (!res.ok) {
          // If profile fetch fails but token already claims admin role, don't lock out
          if (sessionRole === "admin" || sessionRole === "superadmin") {
            if (!isDisposed) {
              setRole(sessionRole);
              setIsAdmin(true);
              setAccessError("");
            }
            return;
          }
          throw new Error("Gagal memverifikasi akses admin.");
        }

        const result = await res.json();
        const detectedRole = String(result?.data?.role || "").toLowerCase();
        const hasAdminRole = ["admin", "superadmin"].includes(detectedRole);

        if (!isDisposed) {
          setRole(detectedRole);
          setIsAdmin(hasAdminRole);

          if (!hasAdminRole) {
            setAccessError(
              "Akun ini tidak memiliki hak akses administrator untuk membuka Command Center.",
            );
          }
        }
      } catch (error) {
        if (abortController.signal.aborted || isDisposed) {
          return;
        }

        setIsAdmin(false);
        setAccessError(
          error?.message ||
            "Terjadi gangguan saat memverifikasi akses admin. Coba lagi beberapa saat.",
        );
      } finally {
        if (!isDisposed && activeController === abortController) {
          setLoading(false);
        }
      }
    };

    let subscription = null;
    let lastUserId = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      if (!session?.user) {
        if (!isDisposed) {
          window.location.replace("/login");
        }
        return;
      }

      lastUserId = session.user.id || session.user.uid;
      await verifyAdmin(session.user, session.access_token);

      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        try {
          if (shouldSkipAuthEvent(_event, session, lastUserId)) {
            return;
          }

          if (!session?.user) {
            if (!isDisposed) {
              window.location.replace("/login");
            }
            return;
          }
          
          lastUserId = session.user.id || session.user.uid;
          await verifyAdmin(session.user, session.access_token);
        } catch (err) {
          console.error("Error in useAdminAuth onAuthStateChange:", err);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      isDisposed = true;
      activeController?.abort();
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    isAdmin,
    role,
    accessError,
  };
}
