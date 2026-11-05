// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import toast from "react-hot-toast";
import styles from "./UserChatView.module.css";
import chatConfig from "@/data/ui/userChatConfig.json";
import { getApiBaseUrl } from "@/lib/apiClient";
import { convertToWebP } from "@/utils/imageConverter";

export default function UserChatView({ user }: { user: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [backendAdminOnline, setBackendAdminOnline] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);

  const isEffectiveAdminOnline = isAdminOnline || backendAdminOnline;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const checkAdminStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let res = await fetch(`${getApiBaseUrl()}/api/chats/status`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok && token) {
        res = await fetch(`${getApiBaseUrl()}/api/user/chats/status`, {
          headers,
          cache: "no-store",
        });
      }
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json.is_online === "boolean") {
          setBackendAdminOnline(json.is_online);
        }
      }
    } catch {
      // ignore network errors
    }
  };

  const sendHeartbeat = async () => {
    const userId = user?.uid || user?.id;
    if (!userId) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const body = JSON.stringify({ role: "user", user_id: userId });
      const res = await fetch(`${getApiBaseUrl()}/api/heartbeat`, {
        method: "POST",
        headers,
        body,
      });
      if (!res.ok && token) {
        await fetch(`${getApiBaseUrl()}/api/user/heartbeat`, {
          method: "POST",
          headers,
          body,
        });
      }
    } catch {
      // ignore network errors
    }
  };

  const fetchMessages = async () => {
    const userId = user?.uid || user?.id;
    if (!userId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      let fetchedData = null;

      // 1. Prioritaskan API Backend Go
      if (token) {
        try {
          const res = await fetch(`${getApiBaseUrl()}/api/user/chats`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          });
          if (res.ok) {
            const json = await res.json();
            if (json?.data && Array.isArray(json.data)) {
              fetchedData = json.data;
            }
          }
        } catch (e) {
          console.warn("[UserChat] Fetching from Go backend failed, fallback to Supabase:", e);
        }
      }

      // 2. Fallback direct Supabase
      if (!fetchedData) {
        const { data, error } = await supabase
          .from("chats")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Gagal mengambil pesan Supabase:", error);
          return;
        }
        fetchedData = data;
      }

      setMessages(fetchedData || []);

      // Tandai pesan admin sebagai telah dibaca
      const unreadAdminMsgIds = (fetchedData || [])
        .filter((m: any) => m.sender_role === "admin" && !m.is_read)
        .map((m: any) => m.id);

      if (unreadAdminMsgIds.length > 0) {
        if (token) {
          fetch(`${getApiBaseUrl()}/api/user/chats/read`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message_ids: unreadAdminMsgIds }),
          }).catch(() => {});
        }

        supabase
          .from("chats")
          .update({ is_read: true })
          .in("id", unreadAdminMsgIds)
          .then();
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMessages();
      checkAdminStatus();
      sendHeartbeat();

      const pollInterval = setInterval(() => {
        checkAdminStatus();
        sendHeartbeat();
      }, 15000);

      // Realtime listener Supabase
      const userId = user?.uid || user?.id;
      const channel = supabase
        .channel(`user-chat-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chats",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const incoming = payload.new;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id)) return prev;
              return [...prev, incoming];
            });

            if (incoming.sender_role === "admin") {
              setIsAdminTyping(false);
              supabase
                .from("chats")
                .update({ is_read: true })
                .eq("id", incoming.id)
                .then();
            }
          }
        )
        .subscribe();

      // Realtime Typing & Presence Channel
      const presenceChannel = supabase.channel(`presence-chat-${userId}`, {
        config: { presence: { key: `user-${userId}` } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          const hasAdmin = Object.values(state).some((presences: any) =>
            presences.some((p: any) => p.role === "admin")
          );
          setIsAdminOnline(hasAdmin);
        })
        .on("broadcast", { event: "typing" }, (payload) => {
          if (payload?.payload?.role === "admin") {
            setIsAdminTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setIsAdminTyping(false);
            }, 3000);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({
              role: "user",
              user_id: userId,
              online_at: new Date().toISOString(),
            });
          }
        });

      presenceChannelRef.current = presenceChannel;

      return () => {
        clearInterval(pollInterval);
        supabase.removeChannel(channel);
        if (presenceChannelRef.current) {
          supabase.removeChannel(presenceChannelRef.current);
        }
      };
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAdminTyping]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 5MB");
        return;
      }
      try {
        const webpFile = await convertToWebP(file);
        setSelectedFile(webpFile);
        setPreviewUrl(URL.createObjectURL(webpFile));
      } catch {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (presenceChannelRef.current) {
      presenceChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { role: "user" },
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed && !selectedFile) return;

    const userId = user?.uid || user?.id;
    if (!userId) {
      toast.error("Silakan masuk akun terlebih dahulu");
      return;
    }

    setIsUploading(true);
    let uploadedImageUrl: string | null = null;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Upload gambar jika ada
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folder", "chats");

        const uploadHeaders: Record<string, string> = {};
        if (token) uploadHeaders["Authorization"] = `Bearer ${token}`;

        let uploadRes = await fetch(`${getApiBaseUrl()}/api/upload/image`, {
          method: "POST",
          headers: uploadHeaders,
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          uploadedImageUrl = uploadJson.url || uploadJson.secure_url;
        } else {
          // Cloudinary direct upload fallback
          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
          const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
          if (cloudName && uploadPreset) {
            const cFormData = new FormData();
            cFormData.append("file", selectedFile);
            cFormData.append("upload_preset", uploadPreset);
            cFormData.append("folder", "chats");

            const cRes = await fetch(
              `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
              { method: "POST", body: cFormData }
            );
            if (cRes.ok) {
              const cJson = await cRes.json();
              uploadedImageUrl = cJson.secure_url;
            }
          }
        }
      }

      const payload: any = {
        message: trimmed,
        image_url: uploadedImageUrl,
        reply_to_id: replyingToMessage ? replyingToMessage.id : null,
      };

      // Kirim via Backend Go
      let sentSuccess = false;
      if (token) {
        try {
          const res = await fetch(`${getApiBaseUrl()}/api/user/chats`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const json = await res.json();
            if (json?.data) {
              setMessages((prev) => [...prev, json.data]);
              sentSuccess = true;
            }
          }
        } catch {
          // Fallback ke Supabase
        }
      }

      if (!sentSuccess) {
        const { data, error } = await supabase
          .from("chats")
          .insert({
            user_id: userId,
            sender_role: "user",
            message: trimmed,
            image_url: uploadedImageUrl,
            reply_to_id: replyingToMessage ? replyingToMessage.id : null,
            is_read: false,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
        }
      }

      setNewMessage("");
      setReplyingToMessage(null);
      removeFile();
    } catch (err: any) {
      console.error("Gagal mengirim pesan:", err);
      toast.error(err.message || "Gagal mengirim pesan.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className={styles.chatContainer}>
        {/* Chat Header */}
        <header className={styles.chatHeader}>
          <div className={styles.headerInfo}>
            <h2 className={styles.chatTitle}>Customer Support</h2>
            <div className={styles.statusIndicator}>
              <span
                className={`${styles.statusDot} ${
                  isEffectiveAdminOnline ? styles.online : ""
                }`}
              />
              <span>
                {isEffectiveAdminOnline
                  ? "Admin Sedang Online"
                  : "Admin Sedang Offline"}
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={fetchMessages}
              className={styles.attachBtn}
              title="Segarkan Chat"
            >
              <AppIcon name="refresh-cw" size={16} />
            </button>
          </div>
        </header>

        {/* Operational Hours Notice */}
        <div className={styles.operationalNotice}>
          <AppIcon name="clock" size={14} />
          <span>
            Jam Operasional: Setiap Hari (18:00 - 21:00 WIB). Pesan di luar jam
            akan dibalas saat admin online.
          </span>
        </div>

        {/* Message List */}
        <main className={styles.messagesList} ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className={styles.emptyChat}>
              <AppIcon name="message-square" size={38} />
              <p>Belum ada percakapan. Sampaikan pertanyaan Anda di sini!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender_role === "user";
              const repliedMsg = msg.reply_to_id
                ? messages.find((m) => m.id === msg.reply_to_id)
                : null;

              return (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${
                    isUser ? styles.user : styles.admin
                  }`}
                >
                  <div className={styles.messageBubble}>
                    {/* Reply Quoted Preview */}
                    {repliedMsg && (
                      <div className={styles.quotedReply}>
                        <span className={styles.quotedSender}>
                          {repliedMsg.sender_role === "admin"
                            ? "Admin"
                            : "Anda"}
                        </span>
                        <span className={styles.quotedSnippet}>
                          {repliedMsg.message ||
                            (repliedMsg.image_url ? "[Gambar]" : "")}
                        </span>
                      </div>
                    )}

                    {/* Attached Product Card if any */}
                    {msg.product_metadata && (
                      <a
                        href={`/dashboard?tab=shop&productId=${msg.product_id}`}
                        className={styles.attachedProductCard}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {msg.product_metadata.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={msg.product_metadata.image_url}
                            alt=""
                            className={styles.attachedProductImg}
                          />
                        )}
                        <div className={styles.attachedProductInfo}>
                          <span className={styles.attachedProductTitle}>
                            {msg.product_metadata.title || "Detail Produk"}
                          </span>
                          {msg.product_metadata.price && (
                            <span className={styles.attachedProductPrice}>
                              Rp {Number(msg.product_metadata.price).toLocaleString("id-ID")}
                            </span>
                          )}
                        </div>
                      </a>
                    )}

                    {/* Attached Image */}
                    {msg.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={msg.image_url}
                        alt="Lampiran"
                        className={styles.bubbleImage}
                        onClick={() => setZoomedImage(msg.image_url)}
                      />
                    )}

                    {/* Text Message */}
                    {msg.message && <p style={{ margin: 0 }}>{msg.message}</p>}

                    {/* Meta Row: Time & Status */}
                    <div className={styles.metaRow}>
                      <span>
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleTimeString(
                              "id-ID",
                              { hour: "2-digit", minute: "2-digit" }
                            )
                          : ""}
                      </span>
                      {isUser && (
                        <span>{msg.is_read ? "✓✓" : "✓"}</span>
                      )}
                    </div>
                  </div>

                  {/* Reply Action Button */}
                  <button
                    onClick={() => setReplyingToMessage(msg)}
                    className={styles.replyActionBtn}
                    title="Balas pesan ini"
                  >
                    <AppIcon name="corner-up-left" size={13} />
                  </button>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {isAdminTyping && (
            <div className={styles.typingIndicator}>
              <span>Admin sedang mengetik</span>
              <div className={styles.typingDots}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        {/* Input Footer */}
        <footer className={styles.inputContainer}>
          {replyingToMessage && (
            <div className={styles.replyBar}>
              <div className={styles.replyBarContent}>
                <span className={styles.replyBarSender}>
                  Membalas {replyingToMessage.sender_role === "admin" ? "Admin" : "Anda"}
                </span>
                <span className={styles.replyBarSnippet}>
                  {replyingToMessage.message ||
                    (replyingToMessage.image_url ? "[Gambar]" : "")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingToMessage(null)}
                className={styles.cancelReplyBtn}
              >
                <AppIcon name="x" size={14} />
              </button>
            </div>
          )}

          {previewUrl && (
            <div className={styles.filePreviewCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className={styles.filePreviewThumb}
              />
              <button
                type="button"
                onClick={removeFile}
                className={styles.removeFileBtn}
                title="Hapus Gambar"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className={styles.inputControlsRow}>
            <input
              type="file"
              accept="image/jpeg, image/png, image/webp"
              style={{ display: "none" }}
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={styles.attachBtn}
              aria-label="Lampirkan Gambar"
            >
              <AppIcon name="image" size={19} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Ketik pesan untuk admin..."
              className={styles.textInput}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedFile) || isUploading}
              className={styles.sendBtn}
              aria-label="Kirim Pesan"
            >
              {isUploading ? (
                <AppIcon name="loader" size={18} className="animate-spin" />
              ) : (
                <AppIcon name="send" size={17} />
              )}
            </button>
          </form>
        </footer>
      </div>

      {/* Lightbox Zoom */}
      {zoomedImage && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setZoomedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImage}
            className={styles.lightboxImage}
            alt="Zoomed attachment"
          />
          <button
            className={styles.lightboxCloseBtn}
            onClick={() => setZoomedImage(null)}
            aria-label="Tutup Preview"
          >
            <AppIcon name="x" size={22} />
          </button>
        </div>
      )}
    </>
  );
}

