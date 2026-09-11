/**
 * imageConverter.ts
 * Utilitas client-side untuk konversi gambar ke format WebP secara otomatis
 * sebelum diunggah ke server / Cloudinary.
 *
 * Keuntungan:
 * 1. Mengurangi ukuran file foto kamera (3-12MB) hingga 70-85% (menjadi ~200-500KB).
 * 2. Menghemat kuota dan mempercepat waktu upload user secara drastis.
 * 3. Menjaga kualitas visual tinggi (lossy perceptual encoding) dengan standar format WebP modern.
 */

export interface WebPConvertOptions {
  /** Kualitas kompresi WebP dari 0.1 hingga 1.0 (default: 0.82) */
  quality?: number;
  /** Batas lebar maksimum dalam pixel (default: 1920) */
  maxWidth?: number;
  /** Batas tinggi maksimum dalam pixel (default: 1920) */
  maxHeight?: number;
}

/**
 * Mengonversi sebuah File gambar ke format WebP (.webp)
 *
 * @param file Objek File gambar asli dari form upload (input file)
 * @param options Opsi kualitas dan dimensi maksimum
 * @returns Promise<File> Objek File baru berformat image/webp
 */
export async function convertToWebP(
  file: File | Blob | null | undefined,
  options: WebPConvertOptions = {}
): Promise<File> {
  if (!file) {
    throw new Error("File gambar tidak valid atau kosong.");
  }

  const { quality = 0.82, maxWidth = 1920, maxHeight = 1920 } = options;

  // Nama file asli jika ada
  const originalName = (file as File).name || "image";

  // Jangan konversi SVG (vektor)
  if (file.type === "image/svg+xml") {
    if (file instanceof File) return file;
    return new File([file], originalName, { type: "image/svg+xml" });
  }

  // Jika bukan tipe image (misal PDF atau dokumen), kembalikan apa adanya
  if (file.type && !file.type.startsWith("image/")) {
    if (file instanceof File) return file;
    return new File([file], originalName, { type: file.type });
  }

  // Generate nama file dengan ekstensi .webp
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  const webpFileName = `${baseName}.webp`;

  // Deteksi lingkungan browser (Canvas API)
  if (typeof window === "undefined" || typeof document === "undefined") {
    if (file instanceof File) return file;
    return new File([file], webpFileName, { type: file.type || "image/webp" });
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Hitung skala resize proporsional jika melebihi batas
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.warn("[imageConverter] Canvas 2D context unavailable, fallback ke file asli.");
          if (file instanceof File) return resolve(file);
          return resolve(new File([file], originalName, { type: file.type }));
        }

        // Render gambar ke canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Ekspor canvas ke Blob WebP
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.warn("[imageConverter] canvas.toBlob gagal membuat blob WebP, fallback ke file asli.");
              if (file instanceof File) return resolve(file);
              return resolve(new File([file], originalName, { type: file.type }));
            }

            const webpFile = new File([blob], webpFileName, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          "image/webp",
          quality
        );
      } catch (canvasErr) {
        console.warn("[imageConverter] Gagal memproses gambar pada canvas:", canvasErr);
        if (file instanceof File) return resolve(file);
        resolve(new File([file], originalName, { type: file.type }));
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      console.warn("[imageConverter] Gagal memuat gambar untuk konversi WebP:", err);
      if (file instanceof File) return resolve(file);
      resolve(new File([file], originalName, { type: file.type }));
    };

    img.src = objectUrl;
  });
}

/**
 * Mengonversi array file gambar ke WebP secara paralel
 */
export async function convertMultipleToWebP(
  files: (File | Blob)[],
  options: WebPConvertOptions = {}
): Promise<File[]> {
  return Promise.all(files.map((f) => convertToWebP(f, options)));
}
