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

    if (
      typeof window !== "undefined" &&
      (res.status === 502 || res.status === 503 || res.status === 504)
    ) {
      window.dispatchEvent(
        new CustomEvent("mameko-server-maintenance", {
          detail: { statusCode: res.status },
        })
      );
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
