import test from "node:test";
import assert from "node:assert/strict";
import {
  isTechnicalOrRawPayload,
  extractMessageFromJsonIfPresent,
  sanitizeUserError,
} from "./errorSanitizer.ts";

test("errorSanitizer: detects raw JSON objects and arrays", () => {
  assert.equal(isTechnicalOrRawPayload('{"error": "Unauthorized", "code": 401}'), true);
  assert.equal(isTechnicalOrRawPayload('[{"message": "failed"}]'), true);
});

test("errorSanitizer: detects SQL and database leak strings", () => {
  assert.equal(isTechnicalOrRawPayload("pq: duplicate key value violates unique constraint"), true);
  assert.equal(isTechnicalOrRawPayload("SQLSTATE 23505"), true);
  assert.equal(isTechnicalOrRawPayload("pgx: query execution error"), true);
  assert.equal(isTechnicalOrRawPayload("sql: no rows in result set"), true);
});

test("errorSanitizer: extracts clean human message from JSON string if available", () => {
  const jsonWithMsg = JSON.stringify({ message: "Kode OTP salah atau telah kadaluarsa" });
  assert.equal(extractMessageFromJsonIfPresent(jsonWithMsg), "Kode OTP salah atau telah kadaluarsa");
});

test("errorSanitizer: sanitizes technical error to fallback message", () => {
  const result = sanitizeUserError("TypeError: Cannot read properties of undefined");
  assert.equal(result, "Terjadi kendala teknis. Silakan coba beberapa saat lagi.");
});

test("errorSanitizer: preserves clean human-friendly message", () => {
  const cleanMsg = "Email belum terdaftar. Silakan periksa kembali.";
  assert.equal(sanitizeUserError(cleanMsg), cleanMsg);
});
