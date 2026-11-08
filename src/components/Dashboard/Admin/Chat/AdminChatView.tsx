"use client";
import { useState, useEffect, useRef } from "react";
import { mamekoClient } from "@/lib/mamekoClient";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./AdminChatView.module.css";
import adminChatConfig from "@/data/ui/adminChatConfig.json";
import { convertToWebP } from "@/utils/imageConverter";
import { getApiBaseUrl } from "@/lib/apiClient";
import { useSearchParams } from "next/navigation";
import { sanitizeUserError } from "@/utils/errorSanitizer";

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {}
};

const QUICK_REPLIES = adminChatConfig.quickReplies || [
  "Halo! Ada yang bisa kami bantu?",
  "Pesanan Anda sedang kami proses.",
  "Mohon tunggu sebentar ya, kami akan segera mengeceknya."
];

export default function AdminChatView({ onUnreadCountChange }: any) {
  const searchParams = useSearchParams();
  const directUserId = searchParams ? searchParams.get("userId") : null;
  const directUserName = searchParams ? searchParams.get("userName") : null;
  const directUserEmail = searchParams ? searchParams.get("userEmail") : null;
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const messagesEndRef = useRef<any>(null);
  const chatContainerRef = useRef<any>(null);
  const fileInputRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
    setIsTyping(false);
  }, [selectedUser]);

  useEffect(() => {
    if (directUserId) {
      const existing = users.find((u) => u.id === directUserId);
      if (existing) {
        setSelectedUser(existing);
      } else {
        const virtualUser = {
          id: directUserId,
          name: directUserName || "Pengguna",
          email: directUserEmail || "",
          avatar: null,
          lastMessage: "",
          unreadCount: 0,
          lastActivity: new Date().toISOString(),
          isOnline: false,
        };
        setUsers((prev) => {
          if (prev.some((u) => u.id === directUserId)) return prev;
          return [virtualUser, ...prev];
        });
        setSelectedUser(virtualUser);
      }
    }
  }, [directUserId, directUserName, directUserEmail, users.length]);

  useEffect(() => {
    fetchUsers();

    const channel = mamekoClient
      .channel("admin_public_chats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incoming = payload.new;
            if (!incoming || !incoming.id) return;
            if (incoming?.sender_role === "user") {
              setIsTyping(false);
              playNotificationSound();
            }
            // Update messages if the active chat matches
            setMessages((prev) => {
              const currentSelected = selectedUserRef.current;
              if (currentSelected && incoming?.user_id === currentSelected.id) {
                // If admin is viewing this chat, mark it as read immediately
                if (incoming.sender_role === "user" && !incoming.is_read) {
                  mamekoClient.auth.getSession().then(({ data: { session } }) => {
                    if (session?.access_token) {
                      fetch(getApiBaseUrl() + `/api/admin/chats/${incoming.user_id}/read`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ ids: [incoming.id] })
                      }).catch(() => {});
                    }
                  });
                  incoming.is_read = true;
                }

                // Check for duplicates
                if (prev.find((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              }
              return prev;
            });
            // Refresh user list to show new message indicators or resort
            fetchUsers();
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new;
            if (!updated) return;
            const currentSelected = selectedUserRef.current;
            if (currentSelected && updated.user_id && updated.user_id !== currentSelected.id) {
              fetchUsers();
              return;
            }
            if (Array.isArray(updated.ids)) {
              const readSet = new Set(updated.ids);
              setMessages((prev) =>
                prev.map((m) => (readSet.has(m.id) ? { ...m, is_read: true } : m))
              );
            } else if (updated.reader_role === "user") {
              setMessages((prev) =>
                prev.map((m) => (m.sender_role === "admin" ? { ...m, is_read: true } : m))
              );
            } else if (updated.id) {
              setMessages((prev) =>
                prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
              );
            }
            fetchUsers();
          }
        }
      )
      .subscribe();

    // Presence & Realtime typing
    const presenceChannel = mamekoClient.channel("public:chats:presence");

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            const uid = p.userId || p.id;
            if (uid && p.role === "user") online.add(uid);
          });
        });
        setOnlineUsers(online);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typingUserId = payload?.userId || payload?.user_id;
        if (
          payload?.role === "user" &&
          (!typingUserId || selectedUserRef.current?.id === typingUserId)
        ) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ role: "admin", id: "admin" });
        }
      });

    presenceChannelRef.current = presenceChannel;

    const sendAdminHeartbeat = async () => {
      try {
        const { data: { session } } = await mamekoClient.auth.getSession();
        if (session?.access_token) {
          fetch(getApiBaseUrl() + "/api/heartbeat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ role: "admin" }),
          }).catch(() => {});
        }
      } catch {}
    };
    sendAdminHeartbeat();
    const heartbeatTimer = setInterval(sendAdminHeartbeat, 20000);

    const syncTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchUsers();
        if (selectedUserRef.current?.id) {
          fetchMessages(selectedUserRef.current.id, true);
        }
      }
    }, 4000);

    const handleWsConnected = () => {
      fetchUsers();
      if (selectedUserRef.current?.id) {
        fetchMessages(selectedUserRef.current.id, true);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("mameko-ws-connected", handleWsConnected);
    }

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(syncTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("mameko-ws-connected", handleWsConnected);
      }
      mamekoClient.removeChannel(channel);
      if (presenceChannelRef.current) {
        mamekoClient.removeChannel(presenceChannelRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);

      // Check user online status via backend in case user is on mobile app
      const checkUserStatus = async () => {
        try {
          const { data: { session } } = await mamekoClient.auth.getSession();
          if (session?.access_token) {
            const res = await fetch(getApiBaseUrl() + `/api/admin/chats/${selectedUser.id}/status`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: "no-store",
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.is_online) {
                setOnlineUsers((prev: any) => new Set([...prev, selectedUser.id]));
              }
            }
          }
        } catch {}
      };
      checkUserStatus();
    } else {
      setMessages([]);
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await mamekoClient.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(getApiBaseUrl() + "/api/admin/chats", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status}`);

      const rawList = Array.isArray(result.data) ? result.data : [];
      const userList = rawList.map((item: any) => ({
        id: item.user_id || item.id,
        name: item.full_name || item.name || item.email || "User",
        email: item.email || "",
        avatar: item.avatar_url || item.photo_url || item.avatar || null,
        lastMessage: item.last_message || item.lastMessage || (item.last_image ? "📷 [Gambar]" : ""),
        unreadCount: Number(item.unread_count ?? item.unreadCount ?? 0),
        lastActivity: item.last_activity,
        isOnline: Boolean(item.is_online || item.isOnline),
      }));
      setUsers(userList);

      const onlineFromBackend = rawList.filter((item: any) => item.is_online || item.isOnline).map((item: any) => item.user_id || item.id);
      if (onlineFromBackend.length > 0) {
        setOnlineUsers((prev: any) => new Set([...prev, ...onlineFromBackend]));
      }

      const totalUnread = userList.reduce((acc: number, u: any) => acc + (u.unreadCount || 0), 0);
      if (onUnreadCountChange) {
        onUnreadCountChange(totalUnread);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  };

  const fetchMessages = async (userId: any, silent = false) => {
    try {
      const { data: { session } } = await mamekoClient.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(getApiBaseUrl() + "/api/admin/chats/" + userId, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status}`);

      const data = Array.isArray(result.data) ? result.data : [];
      setMessages((prev) => {
        if (
          prev.length === data.length &&
          prev.every(
            (m, idx) =>
              m.id === data[idx]?.id &&
              Boolean(m.is_read) === Boolean(data[idx]?.is_read)
          )
        ) {
          return prev;
        }
        return data;
      });

      // Mark unread as read
      const unreadIds = data.filter((m: any) => m.sender_role === "user" && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await fetch(getApiBaseUrl() + "/api/admin/chats/" + userId + "/read", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ ids: unreadIds })
        });
        fetchUsers(); // Refresh unread count in sidebar
      }
    } catch (err) {
      console.error("Fetch messages error:", err);
      if (!silent) {
        toast.error(adminChatConfig.toasts.fetchError || "Gagal mengambil pesan");
      }
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
    if (presenceChannelRef.current && selectedUser) {
      presenceChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { role: "admin", targetUserId: selectedUser.id }
      });
    }
  };

  const handleSendMessage = async (e: any) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !selectedUser || isUploading) return;

    const msgText = newMessage.trim();
    const fileToUpload = selectedFile;
    setNewMessage(""); // Optimistic clear
    removeFile();
    setIsUploading(true);

    try {
      const { data: { session } } = await mamekoClient.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Unauthenticated");

      let imageUrl = null;
      if (fileToUpload) {
        const webpFile = await convertToWebP(fileToUpload, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
        const formData = new FormData();
        formData.append("file", webpFile);
        formData.append("folder", "chats");

        const res = await fetch(getApiBaseUrl() + "/api/user/cloudinary", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
        if (data.secure_url) {
          imageUrl = data.secure_url;
        } else {
          throw new Error("Gagal mengunggah gambar");
        }
      }

      const res = await fetch(getApiBaseUrl() + "/api/admin/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          message: msgText,
          image_url: imageUrl,
          reply_to_id: replyingToMessage ? replyingToMessage.id : null,
        })
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status} - Gagal mengirim pesan`);

      setReplyingToMessage(null);

      // Optimistic update: tambahkan pesan ke state agar langsung muncul
      if (result.data) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === result.data.id)) return prev;
          return [...prev, result.data];
        });
      } else {
        fetchMessages(selectedUser.id);
      }
    } catch (err) {
      console.error("Send message error:", err);
      toast.error(adminChatConfig.toasts.sendError || "Gagal mengirim pesan");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`${styles.chatContainer} ${selectedUser ? styles.chatActive : ""}`}>
      {/* Sidebar Users */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span>{adminChatConfig.sidebarHeader}</span>
          <button
            type="button"
            onClick={fetchUsers}
            className={styles.sidebarRefreshBtn}
            title="Segarkan Percakapan"
            aria-label="Segarkan Percakapan"
          >
            <AppIcon name="refresh-cw" size={14} />
          </button>
        </div>
        <div className={styles.userList}>
          {users.length === 0 ? (
            <div className={styles.emptySidebar}>{adminChatConfig.emptySidebar}</div>
          ) : (
            users.map((u) => {
              const isOnline = onlineUsers.has(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`${styles.userItem} ${selectedUser?.id === u.id ? styles.active : ""}`}
                >
                  <div className={styles.avatarWrapper}>
                    <div className={styles.avatarPlaceholder}>
                      <AppIcon name="user" size={18} />
                    </div>
                    {u.avatar && (
                      <img
                        src={u.avatar}
                        alt={u.name || "User"}
                        className={styles.avatarImg}
                        referrerPolicy="no-referrer"
                        onError={(e: any) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>
                      <span
                        className={`${styles.statusDot} ${isOnline ? styles.statusDotOnline : ""}`}
                      />
                      {u.name || u.email || "User"}
                    </div>
                    <div className={styles.userLastMessage}>
                      {u.lastMessage}
                    </div>
                  </div>
                  {u.unreadCount > 0 && (
                    <div className={styles.unreadBadge}>
                      {u.unreadCount}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={styles.chatArea}>
        {selectedUser ? (
          <>
            <div className={styles.chatHeader}>
              <button
                className={styles.backBtn}
                onClick={() => setSelectedUser(null)}
                aria-label={adminChatConfig.backBtnAria}
              >
                <AppIcon name="arrow-left" size={18} />
              </button>

              <div className={styles.headerAvatarWrapper}>
                <div className={styles.avatarPlaceholder}>
                  <AppIcon name="user" size={20} />
                </div>
                {selectedUser.avatar && (
                  <img
                    src={selectedUser.avatar}
                    alt={selectedUser.name || "User"}
                    className={styles.avatarImg}
                    referrerPolicy="no-referrer"
                    onError={(e: any) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
              </div>

              <div className={styles.headerUserTitle}>
                <span className={styles.headerUserName}>
                  {selectedUser.name || selectedUser.email || "User"}
                </span>
                <span
                  className={`${styles.statusBadge} ${onlineUsers.has(selectedUser.id) ? styles.statusBadgeOnline : ""}`}
                >
                  {onlineUsers.has(selectedUser.id) ? adminChatConfig.online : adminChatConfig.offline}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  fetchUsers();
                  if (selectedUser) fetchMessages(selectedUser.id);
                }}
                className={styles.refreshHeaderBtn}
                title="Segarkan Chat"
                aria-label="Segarkan Chat"
              >
                <AppIcon name="refresh-cw" size={14} />
                <span>Segarkan</span>
              </button>
            </div>
            <div ref={chatContainerRef} className={styles.messagesList}>
              {messages.map((m) => {
                const repliedMsg = m.reply_to_id
                  ? messages.find((msg) => msg.id === m.reply_to_id)
                  : (m.reply_to_message ? { message: m.reply_to_message, sender_role: m.reply_to_sender_role, image_url: m.reply_to_image_url } : null);

                return (
                  <div
                    key={m.id}
                    className={`${styles.bubbleRow} ${m.sender_role === "admin" ? styles.admin : styles.user}`}
                  >
                    <div
                      className={`${styles.messageBubble} ${m.sender_role === "admin" ? styles.admin : styles.user}`}
                    >
                      {/* Quoted Message Preview */}
                      {repliedMsg && (
                        <div className={styles.quotedReply}>
                          <span className={styles.quotedSender}>
                            {repliedMsg.sender_role === "admin" ? "Admin" : (selectedUser?.name || "Pelanggan")}
                          </span>
                          <span className={styles.quotedSnippet}>
                            {repliedMsg.message || (repliedMsg.image_url ? "[Gambar]" : "")}
                          </span>
                        </div>
                      )}

                      {(m.product_metadata || m.product_id) && (
                        <a
                          href={`/product?id=${m.product_id || m.product_metadata?.id}`}
                          className={styles.attachedProductCard}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {m.product_metadata?.image_url && (
                            <img
                              src={m.product_metadata.image_url}
                              alt=""
                              className={styles.attachedProductImg}
                            />
                          )}
                          <div className={styles.attachedProductInfo}>
                            <span className={styles.attachedProductTitle}>
                              {m.product_metadata?.title || m.product_metadata?.name || "Detail Produk"}
                            </span>
                            {m.product_metadata?.price && (
                              <span className={styles.attachedProductPrice}>
                                Rp {Number(m.product_metadata.price).toLocaleString("id-ID")}
                              </span>
                            )}
                          </div>
                        </a>
                      )}

                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt="Attachment"
                          className={`${styles.messageImage} ${m.message ? styles.messageImageWithText : ""}`}
                          onClick={() => setZoomedImage(m.image_url)}
                          onLoad={scrollToBottom}
                        />
                      )}
                      {m.message && <div>{m.message}</div>}
                      <span className={styles.messageTime}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {m.sender_role === "admin" && (
                          <AppIcon name={m.is_read ? "check-check" : "check"} size={14} color={m.is_read ? "var(--info-color, var(--primary-accent))" : "currentColor"} />
                        )}
                      </span>
                    </div>

                    {/* Reply Action Button */}
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(m)}
                      className={styles.replyActionBtn}
                      title="Balas pesan ini"
                    >
                      <AppIcon name="corner-up-left" size={13} />
                    </button>
                  </div>
                );
              })}
              {isTyping && (
                <div className={styles.typingIndicator}>
                  {adminChatConfig.typing || "Pengguna sedang mengetik..."}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {previewUrl && (
              <div className={styles.previewContainer}>
                <img src={previewUrl} alt="Preview" className={styles.previewImg} />
                <button type="button" onClick={removeFile} className={styles.previewRemoveBtn}>
                  <AppIcon name="x" size={12} />
                </button>
              </div>
            )}

            {/* Replying Bar */}
            {replyingToMessage && (
              <div className={styles.replyBar}>
                <div className={styles.replyBarContent}>
                  <span className={styles.replyBarSender}>
                    Membalas {replyingToMessage.sender_role === "admin" ? "Admin" : (selectedUser?.name || "Pelanggan")}
                  </span>
                  <span className={styles.replyBarSnippet}>
                    {replyingToMessage.message || (replyingToMessage.image_url ? "[Gambar]" : "")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToMessage(null)}
                  className={styles.cancelReplyBtn}
                  title="Batal balas"
                >
                  <AppIcon name="x" size={14} />
                </button>
              </div>
            )}

            {/* Quick Replies */}
            <div className={styles.quickRepliesContainer}>
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNewMessage(reply)}
                  className={styles.quickReplyBtn}
                >
                  {reply}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className={styles.chatInputArea}>
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp"
                className={styles.hiddenInput}
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
                <AppIcon name="image" size={20} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder={adminChatConfig.inputPlaceholder || "Tulis balasan..."}
                className={styles.inputField}
              />
              <button
                type="submit"
                disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                className={styles.sendBtn}
              >
                {isUploading ? (
                  <AppIcon name="loader" size={18} className="animate-spin" />
                ) : (
                  <AppIcon name="send" size={18} />
                )}
              </button>
            </form>
            <div className={styles.chatFooterDisclaimer}>
              {adminChatConfig.footerDisclaimer}
            </div>
          </>
        ) : (
          <div className={styles.emptyChat}>
            <AppIcon name="message-square" size={48} opacity={0.3} />
            <p>{adminChatConfig.emptyConversationDesc || "Pilih pengguna dari sidebar untuk mulai chat"}</p>
          </div>
        )}
      </div>

      {/* Lightbox Zoom */}
      {zoomedImage && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setZoomedImage(null)}
        >
          <img src={zoomedImage} className={styles.lightboxImg} alt="Zoomed" />
          <button className={styles.lightboxCloseBtn}>
            <AppIcon name="x" size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
