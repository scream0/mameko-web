import test from "node:test";
import assert from "node:assert/strict";
import { mamekoClient, NativeAuthClient } from "./mamekoClient.ts";

test("mamekoClient: instance has auth with signInWithIdToken method", () => {
  assert.equal(typeof mamekoClient.auth.signInWithIdToken, "function");
});

test("mamekoClient: rejects unsupported OAuth provider", async () => {
  const client = new NativeAuthClient();
  const res = await client.signInWithIdToken({
    provider: "facebook",
    token: "mock_token",
  });
  assert.equal(res.data.user, null);
  assert.equal(res.error?.message, "Provider facebook belum didukung.");
});

test("mamekoClient: rejects empty token", async () => {
  const client = new NativeAuthClient();
  const res = await client.signInWithIdToken({
    provider: "google",
    token: "",
  });
  assert.equal(res.data.user, null);
  assert.equal(res.error?.message, "Token Google wajib disertakan.");
});

