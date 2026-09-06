/**
 * Utility untuk optimasi on-the-fly gambar Cloudinary.
 *
 * Menginjeksikan parameter transformasi Cloudinary:
 * - f_auto: otomatis memilih format gambar paling modern yang didukung browser (AVIF / WebP)
 * - q_auto: kompresi perseptual otomatis (hemat ~75-85% ukuran tanpa degradasi visual)
 * - w_{width},c_limit: resize responsif sesuai kontainer layar (mencegah download gambar 1500px untuk tampilan 350px)
 */

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: string | number;
  crop?: string;
  format?: string;
}

export function optimizeCloudinaryUrl(
  url: string | null | undefined,
  options?: ImageTransformOptions
): string {
  if (!url || typeof url !== "string") return url || "";

  // Hanya proses URL Cloudinary yang valid
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  // Jika URL sudah memiliki transformasi f_auto atau q_auto, kembalikan apa adanya
  if (url.includes("f_auto") || url.includes("q_auto")) {
    return url;
  }

  const {
    width,
    height,
    quality = "auto",
    crop = width && height ? "fill" : "limit",
    format = "auto",
  } = options || {};

  const transformations: string[] = [];

  if (format) {
    transformations.push(`f_${format}`);
  }

  if (quality) {
    transformations.push(`q_${quality}`);
  }

  if (width) {
    transformations.push(`w_${width}`);
  }

  if (height) {
    transformations.push(`h_${height}`);
  }

  if (width || height) {
    transformations.push(`c_${crop}`);
  }

  if (transformations.length === 0) {
    return url;
  }

  const transformString = transformations.join(",");

  return url.replace("/image/upload/", `/image/upload/${transformString}/`);
}

/**
 * Preset ukuran umum untuk konsistensi & caching Cloudinary CDN
 */
export const IMAGE_PRESETS = {
  THUMBNAIL_SM: { width: 100 }, // Navbar search, dropdowns (40-50px displayed)
  THUMBNAIL: { width: 140 },    // Cart sidebar, variant swatches, checkout items (60-80px displayed)
  PRODUCT_CARD: { width: 450 }, // Catalog grid cards (320-350px displayed, 2x retina)
  PRODUCT_DETAIL: { width: 800 }, // Product modal & detail page (500-600px displayed)
  HERO: { width: 900 },         // Hero visual showcase (600-800px displayed)
  ABOUT: { width: 700 },        // Editorial about visual (584px displayed)
} as const;
