// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./AdminChatView.module.css";
import adminChatConfig from "@/data/ui/adminChatConfig.json";
import { convertToWebP } from "@/utils/imageConverter";

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
    setIsTyping(false);
  }, [selectedUser]);

  useEffect(() => {
    fetchUsers();

    // Safely clean up any lingering channels before creating new ones
    const existingMessages = supabase
      .getChannels()
      .find((c) => c.topic === "realtime:admin_public_chats");
    if (existingMessages) {
      supabase.removeChannel(existingMessages);
    }
    const existingPresence = supabase
      .getChannels()
      .find((c) => c.topic === "realtime:public:chats:presence");
    if (existingPresence) {
      supabase.removeChannel(existingPresence);
    }

    const channel = supabase
      .channel("admin_public_chats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incoming = payload.new;
            if (incoming.sender_role === "user") {
              playNotificationSound();
            }
            // Update messages if the active chat matches
            setMessages((prev) => {
              const currentSelected = selectedUserRef.current;
              if (currentSelected && incoming.user_id === currentSelected.id) {
                // If admin is viewing this chat, mark it as read immediately
                if (incoming.sender_role === "user" && !incoming.is_read) {
                  supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session?.access_token) {
                      fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/chats/${incoming.user_id}/read`, {
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
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
            );
          }
        }
      )
      .subscribe();

    // Presence & Realtime typing
    const presenceChannel = supabase.channel("public:chats:presence", {
      config: { presence: { key: "admin_chat_view" } }
    });

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
        if (payload.role === "user" && selectedUserRef.current?.id === payload.userId) {
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

    return () => {
      supabase.removeChannel(channel);
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
    } else {
      setMessages([]);
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats", {
        headers: { Authorization: `Bearer ${token}` }
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
      }));
      setUsers(userList);

      const totalUnread = userList.reduce((acc: number, u: any) => acc + (u.unreadCount || 0), 0);
      if (onUnreadCountChange) {
        onUnreadCountChange(totalUnread);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  };

  const fetchMessages = async (userId: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats/" + userId, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status}`);

      const data = result.data || [];
      setMessages(data);

      // Mark unread as read
      const unreadIds = data.filter((m: any) => m.sender_role === "user" && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats/" + userId + "/read", {
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
      toast.error(adminChatConfig.toasts.fetchError || "Gagal mengambil pesan");
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Unauthenticated");

      let imageUrl = null;
      if (fileToUpload) {
        const webpFile = await convertToWebP(fileToUpload, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
        const formData = new FormData();
        formData.append("file", webpFile);
        formData.append("folder", "chats");

        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
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

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: selectedUser.id, message: msgText, image_url: imageUrl })
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status} - Gagal mengirim pesan`);

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
          {adminChatConfig.sidebarHeader}
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
            </div>
            <div ref={chatContainerRef} className={styles.messagesList}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.messageBubble} ${m.sender_role === "admin" ? styles.admin : styles.user}`}
                >
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
                      <AppIcon name={m.is_read ? "check-check" : "check"} size={14} color={m.is_read ? "#3b82f6" : "currentColor"} />
                    )}
                  </span>
                </div>
              ))}
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
