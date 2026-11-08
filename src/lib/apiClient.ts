/**
 * apiClient.ts
 * Utilitas untuk request ke Golang API dengan base URL dinamis & tangguh.
 */

export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8080";
    }
    // Domain produksi / staging Cloudflare Pages
    return "https://api.mameko.my.id";
  }

  // SSR / Next.js static build phase
  if (process.env.NODE_ENV === "production") {
    return "https://api.mameko.my.id";
  }

  return "http://localhost:8080";
};

/**
 * Fungsi fetch yang sudah digabungkan dengan base URL.
 * Jika URL diawali dengan "/api/", maka akan otomatis diprefix.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let url = endpoint;
  
  if (endpoint.startsWith("/api/")) {
    const base = getApiBaseUrl();
    url = `${base}${endpoint}`;
  }

  // Jika diperlukan setup headers default
  const defaultHeaders = {
    // Content-Type tidak diset default agar FormData tidak rusak, 
    // jika butuh json, komponen biasanya sudah mengsetnya.
  };

  const finalOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const res = await fetch(url, finalOptions);

    const isMaintenanceHeader = res.headers.get("X-Mameko-Maintenance") === "1";
    if (
      typeof window !== "undefined" &&
      (res.status === 502 || res.status === 503 || res.status === 504 || isMaintenanceHeader)
    ) {
      // Do not trigger maintenance view if user is on admin route or admin bypass is active
      const isBypassed = window.sessionStorage.getItem("mameko_admin_bypass") === "true";
      const rawUser = window.sessionStorage.getItem("mameko_user") || window.localStorage.getItem("mameko_user");
      let isAdmin = false;
      if (rawUser) {
        try {
          const u = JSON.parse(rawUser);
          isAdmin = u?.role === "admin" || u?.role === "superadmin";
        } catch {}
      }

      if (!isBypassed && !isAdmin) {
        window.dispatchEvent(
          new CustomEvent("mameko-server-maintenance", {
            detail: { statusCode: res.status },
          })
        );
      }
    }

    return res;
  } catch (error) {
    if (typeof window !== "undefined" && url.includes("/api/")) {
      window.dispatchEvent(
        new CustomEvent("mameko-server-maintenance", {
          detail: { statusCode: 503 },
        })
      );
    }
    throw error;
  }
}
