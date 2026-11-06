/**
 * src/utils/errorSanitizer.ts
 *
 * Mameko Error Sanitizer: Anti Raw-JSON & Human-Friendly Error Handling.
 * Menjamin 0% kebocoran raw JSON, SQL syntax, status code mentah, atau exception class name
 * ke antarmuka pengguna di ekosistem Mameko Web.
 */

const TECHNICAL_PATTERNS = [
  /\{[\s\S]*"error"[\s\S]*\}/i,
  /\{[\s\S]*"message"[\s\S]*\}/i,
  /\{[\s\S]*"statusCode"[\s\S]*\}/i,
  /\[[\s\S]*\]/,
  /<!DOCTYPE/i,
  /<html/i,
  /502 Bad Gateway/i,
  /504 Gateway Time-out/i,
  /SQLSTATE/i,
  /pq:/i,
  /pgx/i,
  /sql:/i,
  /HttpException/i,
  /TypeError:/i,
  /ReferenceError:/i,
  /SocketTimeoutException/i,
  /Failed to fetch/i,
  /NetworkError/i,
  /net::ERR_/i,
  /ECONNREFUSED/i,
];

export function isTechnicalOrRawPayload(msg: string): boolean {
  if (!msg || typeof msg !== "string") return false;
  const trimmed = msg.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return true;
  }
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function extractMessageFromJsonIfPresent(str: string): string | null {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error.trim();
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (parsed.data && typeof parsed.data.error === "string") {
        return parsed.data.error.trim();
      }
    }
  } catch {
    // bukan JSON valid
  }
  return null;
}

export function sanitizeUserError(
  err: any,
  fallback = "Terjadi kendala teknis. Silakan coba beberapa saat lagi."
): string {
  if (!err) return fallback;

  let raw = "";
  if (typeof err === "string") {
    raw = err;
  } else if (err instanceof Error) {
    raw = err.message || "";
  } else if (typeof err === "object") {
    if (typeof err.error === "string") raw = err.error;
    else if (typeof err.message === "string") raw = err.message;
    else {
      try {
        raw = JSON.stringify(err);
      } catch {
        raw = "";
      }
    }
  }

  const extracted = extractMessageFromJsonIfPresent(raw);
  const textToCheck = extracted || raw;
  const lower = textToCheck.toLowerCase();

  // Terjemahkan error jaringan atau timeout
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("koneksi") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused")
  ) {
    return "Koneksi internet bermasalah. Periksa koneksi Anda dan coba lagi.";
  }

  // Terjemahkan error autentikasi
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid_grant") ||
    lower.includes("session expired") ||
    lower.includes("sesi telah berakhir")
  ) {
    return "Sesi Anda telah berakhir. Silakan masuk kembali.";
  }

  // Terjemahkan error izin akses
  if (lower.includes("403") || lower.includes("forbidden") || lower.includes("tidak memiliki izin")) {
    return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  }

  // Terjemahkan error data tidak ditemukan
  if (lower.includes("404") || lower.includes("not found") || lower.includes("tidak ditemukan")) {
    return "Data yang diminta tidak ditemukan.";
  }

  // Terjemahkan error limit rate
  if (lower.includes("429") || lower.includes("too many requests") || lower.includes("banyak permintaan")) {
    return "Terlalu banyak permintaan. Mohon tunggu beberapa saat sebelum mencoba lagi.";
  }

  // Terjemahkan error OTP
  if (
    lower.includes("expired") ||
    lower.includes("invalid token") ||
    lower.includes("invalid otp") ||
    lower.includes("otp salah") ||
    lower.includes("kedaluwarsa")
  ) {
    return "Kode OTP salah atau telah kedaluwarsa. Silakan minta kode baru.";
  }

  // Terjemahkan error gateway 502 / 504 / 500
  if (
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("500") ||
    lower.includes("bad gateway") ||
    lower.includes("internal server error")
  ) {
    return "Layanan sedang dalam pemeliharaan berkala. Silakan coba beberapa saat lagi.";
  }

  // Jika terdeteksi kebocoran teknis atau raw JSON
  if (isTechnicalOrRawPayload(textToCheck)) {
    return fallback;
  }

  return textToCheck.trim() || fallback;
}

