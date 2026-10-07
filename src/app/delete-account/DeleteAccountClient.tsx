"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { supabase } from "@/lib/supabaseClient";
import { getApiBaseUrl } from "@/lib/apiClient";
import toast from "react-hot-toast";
import styles from "./DeleteAccount.module.css";
import contactConfig from "@/data/ui/contactConfig.json";

export function DeleteAccountClient() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Form state for non-logged-in guest request
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestReason, setGuestReason] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user?.id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, username, email, phone")
            .eq("id", currentSession.user.id)
            .maybeSingle();
          if (prof) setProfile(prof);
        }
      } catch (e) {
        console.error("Error fetching user session", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleDeleteSelf = async () => {
    if (!session?.access_token) return;

    setDeleting(true);
    const toastId = toast.loading("Memproses penghapusan akun...");

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || "Gagal menghapus akun.");
      }

      toast.success("Akun dan data pribadi berhasil dihapus.", { id: toastId });
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menghapus akun.", { id: toastId });
    } finally {
      setDeleting(false);
      setShowConfirmModal(false);
    }
  };

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim()) {
      toast.error("Mohon masukkan email yang terdaftar.");
      return;
    }

    // Format WhatsApp prefilled message
    const waNumber = contactConfig.whatsappNumber || "6285171723607";
    const textMsg = encodeURIComponent(
      `Halo Admin Make Me Kool (Mameko),\n\nSaya ingin mengajukan permohonan resmi *Penghapusan Akun & Data Pribadi* sesuai UU PDP:\n- Email Akun: ${guestEmail.trim()}\n- Nomor Kontak: ${guestPhone.trim() || "-"}\n- Alasan: ${guestReason.trim() || "Permintaan Pengguna"}\n\nMohon bantuannya untuk memverifikasi dan memproses permintaan ini. Terima kasih.`
    );

    const waUrl = `https://wa.me/${waNumber}?text=${textMsg}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");

    setRequestSent(true);
    toast.success("Permintaan telah disiapkan. Silakan kirimkan pesan ke WhatsApp Admin.");
  };

  return (
    <div className={styles.contentContainer}>
      {/* 1. Transparansi Hak Penghapusan Data */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <AppIcon name="shield-check" size={20} className="text-amber-500" />
          <h2 className={styles.cardTitle}>Transparansi Perlindungan Data (UU PDP)</h2>
        </div>
        <p className={styles.pageSubtitle} style={{ fontSize: "0.92rem", margin: 0, textAlign: "left" }}>
          Sesuai dengan <strong>Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi</strong> dan kebijakan platform global, Anda memiliki hak penuh untuk meminta penghapusan akun serta seluruh data pribadi yang tersimpan pada sistem Make Me Kool.
        </p>

        <div className={styles.transparencyGrid}>
          <div className={`${styles.transparencyBox} ${styles.boxDeleted}`}>
            <span className={styles.boxTitle}>
              <AppIcon name="trash-2" size={16} />
              Dihapus Permanen
            </span>
            <ul className={styles.boxList}>
              <li>Informasi profil &amp; avatar Cloudinary</li>
              <li>Alamat pengiriman yang tersimpan</li>
              <li>Kredensial login &amp; sesi autentikasi Supabase</li>
              <li>Keranjang belanja &amp; voucher yang tersisa</li>
            </ul>
          </div>

          <div className={`${styles.transparencyBox} ${styles.boxAnonymized}`}>
            <span className={styles.boxTitle}>
              <AppIcon name="receipt" size={16} />
              Dianonimkan (Kepatuhan Hukum)
            </span>
            <ul className={styles.boxList}>
              <li>Riwayat faktur pembayaran (data pribadi dihapus / diputus)</li>
              <li>Dipertahankan selama 5 tahun sesuai regulasi perpajakan</li>
              <li>Data audit keuangan yang tidak dapat ditautkan ke Anda</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Tindakan: Logged In vs Non-Logged In */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <AppIcon name="user" size={20} />
          <h2 className={styles.cardTitle}>
            {user ? "Hapus Akun Aktif Anda" : "Formulir Permintaan Penghapusan Data"}
          </h2>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Memeriksa sesi pengguna...
          </p>
        ) : user ? (
          <div>
            <div className={styles.userBadgeBox}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {profile?.full_name || user?.user_metadata?.full_name || "Pengguna Terdaftar"}
                </span>
                <span className={styles.userEmail}>{user?.email}</span>
                {profile?.phone && (
                  <span className={styles.userEmail}>No. HP: {profile.phone}</span>
                )}
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                Sesi Aktif
              </span>
            </div>

            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Peringatan: Tindakan ini bersifat <strong>permanen dan tidak dapat dibatalkan</strong>. Semua hak akses ke riwayat pesanan serta poin dan voucher akan segera hangus.
            </p>

            <button
              type="button"
              className={styles.btnDeleteAccount}
              onClick={() => setShowConfirmModal(true)}
              disabled={deleting}
            >
              <AppIcon name="trash-2" size={18} />
              <span>{deleting ? "Menghapus Akun..." : "Hapus Akun & Data Saya Sekarang"}</span>
            </button>
          </div>
        ) : (
          <div>
            {requestSent ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(16, 185, 129, 0.12)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                  <AppIcon name="check-circle" size={24} />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Permintaan Sedang Diproses
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", maxWidth: "420px", margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
                  Tim kami akan memverifikasi kepemilikan akun Anda dan menyelesaikan penghapusan data dalam waktu maksimal 3x24 jam kerja sesuai ketentuan UU PDP.
                </p>
                <button
                  type="button"
                  onClick={() => setRequestSent(false)}
                  className={styles.btnSubmitRequest}
                  style={{ width: "auto", padding: "0.6rem 1.25rem", margin: "0 auto" }}
                >
                  Kirim Pengajuan Baru
                </button>
              </div>
            ) : (
              <form onSubmit={handleGuestSubmit}>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.25rem", lineHeight: 1.55 }}>
                  Jika Anda tidak dapat masuk ke akun atau ingin mengajukan penghapusan data secara manual, silakan isi formulir di bawah ini. Tim kami akan segera menindaklanjuti.
                </p>

                <div className={styles.formGroup}>
                  <label htmlFor="guestEmail" className={styles.formLabel}>
                    Alamat Email Terdaftar <span style={{ color: "var(--danger-color)" }}>*</span>
                  </label>
                  <input
                    id="guestEmail"
                    type="email"
                    required
                    placeholder="nama@email.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className={styles.formInput}
                  />
                  <span className={styles.formHint}>Email yang digunakan saat membuat akun di Mameko.</span>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="guestPhone" className={styles.formLabel}>
                    Nomor WhatsApp / Kontak (Opsional)
                  </label>
                  <input
                    id="guestPhone"
                    type="tel"
                    placeholder="0812xxxxxxxx"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="guestReason" className={styles.formLabel}>
                    Alasan Penghapusan (Opsional)
                  </label>
                  <textarea
                    id="guestReason"
                    rows={3}
                    placeholder="Contoh: Tidak lagi menggunakan layanan, ingin menghapus data pribadi..."
                    value={guestReason}
                    onChange={(e) => setGuestReason(e.target.value)}
                    className={styles.formTextarea}
                  />
                </div>

                <button type="submit" className={styles.btnSubmitRequest}>
                  <AppIcon name="send" size={16} />
                  <span>Ajukan Permohonan Penghapusan via WhatsApp Admin</span>
                </button>

                <div className={styles.loginPrompt}>
                  Punya akses masuk ke akun Anda?{" "}
                  <Link href="/login" className={styles.loginLink}>
                    Masuk ke Akun
                  </Link>{" "}
                  untuk menghapus akun secara instan tanpa menunggu verifikasi manual.
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* 3. Saluran Pengaduan Lainnya */}
      <div className={styles.card} style={{ background: "var(--surface-secondary)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Saluran Bantuan Resmi &amp; Pengaduan
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
          Anda juga dapat mengirimkan surat permohonan tertulis langsung ke alamat email resmi kami di{" "}
          <a href="mailto:support@mameko.my.id" style={{ color: "var(--secondary)", fontWeight: 600 }}>
            support@mameko.my.id
          </a>{" "}
          dengan subjek <code>Permohonan Penghapusan Akun &amp; Data - [Nama Anda]</code>.
        </p>
      </div>

      {/* MODAL KONFIRMASI PENGHAPUSAN AKUN INSTAN */}
      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setShowConfirmModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIconWrapper}>
              <AppIcon name="alert-triangle" size={28} />
            </div>
            <h3 className={styles.modalTitle}>Konfirmasi Hapus Akun</h3>
            <p className={styles.modalMessage}>
              Apakah Anda yakin ingin menghapus akun <strong>{user?.email}</strong>? Tindakan ini tidak dapat dibatalkan dan seluruh profil serta preferensi Anda akan dihapus secara permanen.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnCancel}
                onClick={() => setShowConfirmModal(false)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.modalBtnConfirm}
                onClick={handleDeleteSelf}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Akun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
