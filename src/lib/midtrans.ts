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

export function loadMidtransSnap(clientKey?: string, isProduction?: boolean): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  // Jika snap sudah tersedia di window, langsung kembalikan
  if (window.snap) {
    return Promise.resolve(window.snap);
  }

  // Gunakan singleton promise agar tidak ada multiple script injection
  if (snapPromise) {
    return snapPromise;
  }

  snapPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById("midtrans-snap-script") as HTMLScriptElement | null;
    if (existingScript) {
      if (window.snap) {
        resolve(window.snap);
        return;
      }
      existingScript.addEventListener("load", () => resolve(window.snap));
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "midtrans-snap-script";
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";

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
