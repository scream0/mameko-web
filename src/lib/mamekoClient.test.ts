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

test("mamekoClient: channel() returns isolated instances so removeChannel never clobbers sibling channels", () => {
  const ch1 = mamekoClient.channel("public:chats:presence");
  const ch2 = mamekoClient.channel("public:chats:presence");

  assert.notEqual(ch1, ch2);

  let ch2Received = 0;
  ch2
    .on("postgres_changes", { event: "INSERT", table: "chats" }, () => {
      ch2Received += 1;
    })
    .subscribe();

  ch1.subscribe();
  mamekoClient.removeChannel(ch1);

  ch2.dispatchMessage({
    event: "new_message",
    data: { id: "msg-1", user_id: "u1", message: "Halo" },
  });

  assert.equal(ch2Received, 1);
  mamekoClient.removeChannel(ch2);
});

test("mamekoClient: dispatchMessage enforces event type, table, and user_id filters", () => {
  const ch = mamekoClient.channel("user-chat-u1");
  const inserts: any[] = [];
  const updates: any[] = [];
  const notifEvents: any[] = [];
  const typingEvents: any[] = [];

  ch.on(
    "postgres_changes",
    { event: "INSERT", table: "chats", filter: "user_id=eq.u1" },
    (p) => inserts.push(p)
  )
    .on(
      "postgres_changes",
      { event: "UPDATE", table: "chats", filter: "user_id=eq.u1" },
      (p) => updates.push(p)
    )
    .on(
      "postgres_changes",
      { event: "*", table: "notifications" },
      (p) => notifEvents.push(p)
    )
    .on("broadcast", { event: "typing" }, (p) => typingEvents.push(p))
    .subscribe();

  // Message for different user u2 -> must be ignored by u1 filter
  ch.dispatchMessage({
    event: "new_message",
    data: { id: "msg-u2", user_id: "u2", message: "Other user" },
  });
  assert.equal(inserts.length, 0);

  // Message for u1 -> must match INSERT listener only
  ch.dispatchMessage({
    event: "new_message",
    data: { id: "msg-u1", user_id: "u1", message: "For u1" },
  });
  assert.equal(inserts.length, 1);
  assert.equal(updates.length, 0);
  assert.equal(notifEvents.length, 0);

  // Read receipt for u1 -> must match UPDATE listener only, never INSERT
  ch.dispatchMessage({
    event: "messages_read",
    data: { user_id: "u1", reader_role: "admin", ids: ["msg-u1"] },
  });
  assert.equal(inserts.length, 1);
  assert.equal(updates.length, 1);

  // Typing broadcast -> must match broadcast typing listener
  ch.dispatchMessage({
    event: "typing",
    data: { role: "admin", targetUserId: "u1" },
  });
  assert.equal(typingEvents.length, 1);
  assert.equal(typingEvents[0].payload.role, "admin");

  mamekoClient.removeChannel(ch);
});

test("NativeAuthClient: notifyListeners catches both sync exceptions and async rejections safely", () => {
  const client = new NativeAuthClient();

  // Add an async listener that rejects
  client.onAuthStateChange(async () => {
    throw new Error("Simulated async listener error during login");
  });

  // Add a sync listener that throws
  client.onAuthStateChange(() => {
    throw new Error("Simulated sync listener error during login");
  });

  // Calling notifyListeners should NOT throw or trigger unhandled rejection
  assert.doesNotThrow(() => {
    (client as any).notifyListeners("SIGNED_IN", {
      access_token: "test_token",
      user: {
        id: "u123",
        email: "test@example.com",
        user_metadata: { full_name: "Test User", role: "customer" },
      },
    });
  });
});



