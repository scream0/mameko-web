// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { useScrollLock } from "@/hooks/useScrollLock";
import toast from "react-hot-toast";
import styles from "./UserChatModal.module.css";
import chatConfig from "@/data/ui/userChatConfig.json";
import { getApiBaseUrl } from "@/lib/apiClient";
import { convertToWebP } from "@/utils/imageConverter";

export default function UserChatModal({ isOpen, onClose, user }: any) {
  useScrollLock(Boolean(isOpen));
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
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
      const res = await fetch(`${getApiBaseUrl()}/api/chats/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
      await fetch(`${getApiBaseUrl()}/api/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: "user", user_id: userId }),
      });
    } catch {
      // ignore network errors
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchMessages();
      checkAdminStatus();
      sendHeartbeat();

      const pollInterval = setInterval(() => {
        checkAdminStatus();
        sendHeartbeat();
      }, 15000);

      const channel = supabase
        .channel("public:chats:user")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chats",
            filter: `user_id=eq.${user.uid || user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const incoming = payload.new;
              setMessages((prev) => {
                if (prev.find((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
            } else if (payload.eventType === "UPDATE") {
              const updated = payload.new;
              setMessages((prev) =>
                prev.map((m) => (m.id === updated.id ? updated : m))
              );
            }
          }
        )
        .subscribe();

      const presenceChannel = supabase.channel("public:chats:presence", {
        config: { presence: { key: user.uid || user.id } },
      });
      presenceChannelRef.current = presenceChannel;

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          let adminOnline = false;
          for (const key in state) {
            if (state[key].some((s: any) => s.role === "admin"))
              adminOnline = true;
          }
          setIsAdminOnline(adminOnline);
        })
        .on("broadcast", { event: "typing" }, (payload) => {
          if (
            payload.payload.role === "admin" &&
            payload.payload.targetUserId === (user.uid || user.id)
          ) {
            setIsAdminTyping(true);
            if (typingTimeoutRef.current)
              clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(
              () => setIsAdminTyping(false),
              3000
            );
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({
              role: "user",
              userId: user.uid || user.id,
              id: user.uid || user.id,
            });
          }
        });

      return () => {
        clearInterval(pollInterval);
        supabase.removeChannel(channel);
        supabase.removeChannel(presenceChannel);
      };
    }
  }, [isOpen, user]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  useEffect(() => {
    const timer1 = setTimeout(scrollToBottom, 50);
    const timer2 = setTimeout(scrollToBottom, 300);
    const timer3 = setTimeout(scrollToBottom, 600);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [messages, isOpen]);

  const fetchMessages = async () => {
    const userId = user.uid || user.id;
    if (!userId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(
        getApiBaseUrl() + "/api/user/chats",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const result = res.headers
        ?.get("content-type")
        ?.includes("application/json")
        ? await res.json()
        : {};
      if (!res.ok || !result.success)
        throw new Error(
          result.error || `HTTP ${res.status} - Gagal mengambil pesan`
        );

      const data = result.data || [];
      setMessages(data);

      // Tandai pesan admin sebagai telah dibaca
      const unreadIds = data
        .filter((m: any) => m.sender_role === "admin" && !m.is_read)
        .map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await fetch(
          getApiBaseUrl() + "/api/user/chats/read",
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ ids: unreadIds }),
          }
        );
      }
    } catch (err) {
      console.error("Fetch messages error:", err);
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran gambar maksimal 5MB");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTyping = (e: any) => {
    setNewMessage(e.target.value);
    if (presenceChannelRef.current) {
      presenceChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { role: "user", userId: user.uid || user.id },
      });
    }
  };

  const handleSendMessage = async (e: any) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || isUploading) return;

    const msgText = newMessage.trim();
    const fileToUpload = selectedFile;
    setNewMessage("");
    removeFile();
    setIsUploading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Unauthenticated");

      let imageUrl = null;
      if (fileToUpload) {
        const webpFile = await convertToWebP(fileToUpload, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
        const formData = new FormData();
        formData.append("file", webpFile);
        formData.append("userId", user.uid || user.id);
        formData.append("folder", "chats");

        const res = await fetch(
          getApiBaseUrl() + "/api/user/cloudinary",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }
        );
        const data = await res.json();
        if (data.secure_url) {
          imageUrl = data.secure_url;
        } else {
          throw new Error(chatConfig?.errors?.uploadFailed || "Gagal mengunggah gambar");
        }
      }

      const res = await fetch(
        getApiBaseUrl() + "/api/user/chats",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: msgText, image_url: imageUrl }),
        }
      );
      const result = res.headers
        ?.get("content-type")
        ?.includes("application/json")
        ? await res.json()
        : {};
      if (!res.ok || !result.success)
        throw new Error(result.error || `HTTP ${res.status} - Gagal mengirim pesan`);

      if (result.data) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === result.data.id)) return prev;
          return [...prev, result.data];
        });
      } else {
        fetchMessages();
      }
    } catch (err: any) {
      console.error("Send message error:", err);
      toast.error(err.message || chatConfig?.errors?.sendFailed || "Gagal mengirim pesan");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.chatOverlay} onClick={onClose} />
      <aside className={styles.chatContainer}>
        {/* Header */}
        <header className={styles.chatHeader}>
          <div className={styles.headerInfo}>
            <h3 className={styles.chatTitle}>
              {chatConfig?.header?.title || "Chat dengan Admin"}
            </h3>
            <div className={styles.statusIndicator}>
              <span
                className={`${styles.statusDot} ${
                  isEffectiveAdminOnline ? styles.online : ""
                }`}
              />
              <span>
                {isEffectiveAdminOnline
                  ? chatConfig?.header?.statusOnline || "Online"
                  : chatConfig?.header?.statusOffline || "Offline"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label={chatConfig?.header?.closeAriaLabel || "Tutup Chat"}
          >
            <AppIcon name="x" size={20} />
          </button>
        </header>

        {/* Message Body */}
        <div ref={chatContainerRef} className={styles.messagesBody}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <AppIcon name="message-circle" size={36} />
              </div>
              <p>
                {chatConfig?.messages?.emptyState ||
                  "Mulai obrolan dengan admin Mameko."}
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.sender_role === "user";
              return (
                <div
                  key={m.id}
                  className={`${styles.messageRow} ${
                    isUser ? styles.user : styles.admin
                  }`}
                >
                  <div className={styles.messageBubble}>
                    {m.image_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={m.image_url}
                        alt={
                          chatConfig?.messages?.attachmentAlt || "Lampiran Gambar"
                        }
                        className={styles.messageAttachment}
                        onClick={() => setZoomedImage(m.image_url)}
                        onLoad={scrollToBottom}
                      />
                    )}
                    {m.message && <div>{m.message}</div>}
                    <div className={styles.metaRow}>
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isUser && (
                        <AppIcon
                          name={m.is_read ? "check-check" : "check"}
                          size={14}
                          color={m.is_read ? "#38bdf8" : "currentColor"}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isAdminTyping && (
            <div className={styles.typingIndicator}>
              <span>
                {chatConfig?.messages?.adminTyping || "Admin sedang mengetik..."}
              </span>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <footer className={styles.inputContainer}>
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
                title={chatConfig?.input?.removeImageTitle || "Hapus Gambar"}
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
              aria-label={chatConfig?.input?.attachAria || "Lampirkan Gambar"}
            >
              <AppIcon name="image" size={19} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder={
                chatConfig?.input?.placeholder || "Ketik pesan untuk admin..."
              }
              className={styles.textInput}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedFile) || isUploading}
              className={styles.sendBtn}
              aria-label={chatConfig?.input?.sendAria || "Kirim Pesan"}
            >
              {isUploading ? (
                <AppIcon name="loader" size={18} className="animate-spin" />
              ) : (
                <AppIcon name="send" size={17} />
              )}
            </button>
          </form>
        </footer>
      </aside>

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
            aria-label={
              chatConfig?.messages?.imageZoomClose || "Tutup Preview"
            }
          >
            <AppIcon name="x" size={22} />
          </button>
        </div>
      )}
    </>
  );
}
