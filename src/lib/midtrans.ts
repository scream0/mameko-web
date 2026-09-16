// Utility untuk memuat script Midtrans Snap secara On-Demand (Lazy-Load)
// Menghindari unduhan skrip 4.6 detik & 9 Google Fonts di landing page awal.

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: any) => void;
      embed?: (token: string, options: any) => void;
    };
  }
}

let snapPromise: Promise<any> | null = null;
let currentIsProduction: boolean | null = null;

export function loadMidtransSnap(clientKey?: string, isProduction?: boolean): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  const targetUrl = isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

  // Periksa apakah ada script tag yang sudah terpasang di DOM
  const existingScript = document.getElementById("midtrans-snap-script") as HTMLScriptElement | null;

  // Jika environment berubah (misal dari default sandbox ke production), reload script yang benar
  if (existingScript && currentIsProduction !== null && currentIsProduction !== Boolean(isProduction)) {
    existingScript.remove();
    if (window.snap) {
      delete window.snap;
    }
    snapPromise = null;
  }

  // Jika snap sudah tersedia di window dan environment cocok, langsung kembalikan
  if (window.snap && currentIsProduction === Boolean(isProduction)) {
    return Promise.resolve(window.snap);
  }

  // Gunakan singleton promise jika environment sama
  if (snapPromise && currentIsProduction === Boolean(isProduction)) {
    return snapPromise;
  }

  currentIsProduction = Boolean(isProduction);

  snapPromise = new Promise((resolve, reject) => {
    const currentScript = document.getElementById("midtrans-snap-script") as HTMLScriptElement | null;
    if (currentScript) {
      if (window.snap) {
        resolve(window.snap);
        return;
      }
      currentScript.addEventListener("load", () => resolve(window.snap));
      currentScript.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "midtrans-snap-script";
    script.src = targetUrl;

    const resolvedClientKey =
      clientKey ||
      (isProduction
        ? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_PRODUCTION
        : process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX);

    if (resolvedClientKey) {
      script.setAttribute("data-client-key", resolvedClientKey);
    }

    script.async = true;
    script.onload = () => {
      resolve(window.snap);
    };
    script.onerror = (err) => {
      snapPromise = null;
      reject(err);
    };

    document.body.appendChild(script);
  });

  return snapPromise;
}
