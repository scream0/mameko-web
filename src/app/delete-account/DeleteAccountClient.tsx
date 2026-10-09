"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { supabase } from "@/lib/supabaseClient";
import { getApiBaseUrl } from "@/lib/apiClient";
import toast from "react-hot-toast";
import styles from "./DeleteAccount.module.css";
import contactConfig from "@/data/ui/contactConfig.json";
import deleteConfig from "@/data/ui/deleteAccountConfig.json";

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
    const toastId = toast.loading(deleteConfig.toasts.processing);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || deleteConfig.toasts.failed);
      }

      toast.success(deleteConfig.toasts.success, { id: toastId });
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || deleteConfig.toasts.generalError, { id: toastId });
    } finally {
      setDeleting(false);
      setShowConfirmModal(false);
    }
  };

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim()) {
      toast.error(deleteConfig.toasts.emailRequired);
      return;
    }

    // Format WhatsApp prefilled message
    const waNumber = contactConfig.whatsappNumber || "6285171723607";
    const reasonText = guestReason.trim() || deleteConfig.waMessage.defaultReason;
    const phoneText = guestPhone.trim() || "-";
    const textMsg = encodeURIComponent(
      `${deleteConfig.waMessage.greeting}${guestEmail.trim()}${deleteConfig.waMessage.phonePrefix}${phoneText}${deleteConfig.waMessage.reasonPrefix}${reasonText}${deleteConfig.waMessage.closing}`
    );

    const waUrl = `https://wa.me/${waNumber}?text=${textMsg}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");

    setRequestSent(true);
    toast.success(deleteConfig.toasts.waPrepared);
  };

  return (
    <div className={styles.contentContainer}>
      {/* 1. Transparansi Hak Penghapusan Data */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <AppIcon name="shield-check" size={20} className={styles.requiredStar} />
          <h2 className={styles.cardTitle}>{deleteConfig.transparency.title}</h2>
        </div>
        <p className={styles.cardSubtitle}>
          {deleteConfig.transparency.description}
        </p>

        <div className={styles.transparencyGrid}>
          <div className={`${styles.transparencyBox} ${styles.boxDeleted}`}>
            <span className={styles.boxTitle}>
              <AppIcon name="trash-2" size={16} />
              {deleteConfig.transparency.deleted.title}
            </span>
            <ul className={styles.boxList}>
              {deleteConfig.transparency.deleted.items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className={`${styles.transparencyBox} ${styles.boxAnonymized}`}>
            <span className={styles.boxTitle}>
              <AppIcon name="receipt" size={16} />
              {deleteConfig.transparency.anonymized.title}
            </span>
            <ul className={styles.boxList}>
              {deleteConfig.transparency.anonymized.items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Tindakan: Logged In vs Non-Logged In */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <AppIcon name="user" size={20} />
          <h2 className={styles.cardTitle}>
            {user ? deleteConfig.sessionAction.loggedInTitle : deleteConfig.sessionAction.guestTitle}
          </h2>
        </div>

        {loading ? (
          <p className={styles.sessionLoading}>
            {deleteConfig.sessionAction.checkingSession}
          </p>
        ) : user ? (
          <div>
            <div className={styles.userBadgeBox}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {profile?.full_name || user?.user_metadata?.full_name || deleteConfig.sessionAction.defaultUser}
                </span>
                <span className={styles.userEmail}>{user?.email}</span>
                {profile?.phone && (
                  <span className={styles.userEmail}>
                    {deleteConfig.sessionAction.phonePrefix}{profile.phone}
                  </span>
                )}
              </div>
              <span className={styles.activeBadge}>
                {deleteConfig.sessionAction.activeSessionBadge}
              </span>
            </div>

            <p className={styles.warningNotice}>
              {deleteConfig.sessionAction.warningNotice}
            </p>

            <button
              type="button"
              className={styles.btnDeleteAccount}
              onClick={() => setShowConfirmModal(true)}
              disabled={deleting}
            >
              <AppIcon name="trash-2" size={18} />
              <span>
                {deleting
                  ? deleteConfig.sessionAction.deletingBtn
                  : deleteConfig.sessionAction.deleteBtn}
              </span>
            </button>
          </div>
        ) : (
          <div>
            {requestSent ? (
              <div className={styles.requestSentContainer}>
                <div className={styles.successIconWrapper}>
                  <AppIcon name="check-circle" size={24} />
                </div>
                <h3 className={styles.successTitle}>
                  {deleteConfig.guestForm.success.title}
                </h3>
                <p className={styles.successDesc}>
                  {deleteConfig.guestForm.success.description}
                </p>
                <button
                  type="button"
                  onClick={() => setRequestSent(false)}
                  className={`${styles.btnSubmitRequest} ${styles.btnNewRequest}`}
                >
                  {deleteConfig.guestForm.success.newRequestBtn}
                </button>
              </div>
            ) : (
              <form onSubmit={handleGuestSubmit}>
                <p className={styles.guestIntro}>
                  {deleteConfig.guestForm.intro}
                </p>

                <div className={styles.formGroup}>
                  <label htmlFor="guestEmail" className={styles.formLabel}>
                    {deleteConfig.guestForm.emailLabel}{" "}
                    <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="guestEmail"
                    type="email"
                    required
                    placeholder={deleteConfig.guestForm.emailPlaceholder}
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className={styles.formInput}
                  />
                  <span className={styles.formHint}>
                    {deleteConfig.guestForm.emailHint}
                  </span>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="guestPhone" className={styles.formLabel}>
                    {deleteConfig.guestForm.phoneLabel}
                  </label>
                  <input
                    id="guestPhone"
                    type="tel"
                    placeholder={deleteConfig.guestForm.phonePlaceholder}
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="guestReason" className={styles.formLabel}>
                    {deleteConfig.guestForm.reasonLabel}
                  </label>
                  <textarea
                    id="guestReason"
                    rows={3}
                    placeholder={deleteConfig.guestForm.reasonPlaceholder}
                    value={guestReason}
                    onChange={(e) => setGuestReason(e.target.value)}
                    className={styles.formTextarea}
                  />
                </div>

                <button type="submit" className={styles.btnSubmitRequest}>
                  <AppIcon name="send" size={16} />
                  <span>{deleteConfig.guestForm.submitBtn}</span>
                </button>

                <div className={styles.loginPrompt}>
                  {deleteConfig.guestForm.loginPromptPrefix}
                  <Link href="/login" className={styles.loginLink}>
                    {deleteConfig.guestForm.loginLinkText}
                  </Link>
                  {deleteConfig.guestForm.loginPromptSuffix}
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* 3. Saluran Pengaduan Lainnya */}
      <div className={`${styles.card} ${styles.supportCard}`}>
        <h3 className={styles.supportTitle}>
          {deleteConfig.support.title}
        </h3>
        <p className={styles.supportDesc}>
          {deleteConfig.support.textPrefix}
          <a
            href={`mailto:${deleteConfig.support.email}`}
            className={styles.supportEmailLink}
          >
            {deleteConfig.support.email}
          </a>
          {deleteConfig.support.textSubjectPrefix}
          <code>{deleteConfig.support.subject}</code>.
        </p>
      </div>

      {/* MODAL KONFIRMASI PENGHAPUSAN AKUN INSTAN */}
      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setShowConfirmModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIconWrapper}>
              <AppIcon name="alert-triangle" size={28} />
            </div>
            <h3 className={styles.modalTitle}>{deleteConfig.confirmModal.title}</h3>
            <p className={styles.modalMessage}>
              {deleteConfig.confirmModal.messageTemplate.replace("{email}", user?.email || "")}
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnCancel}
                onClick={() => setShowConfirmModal(false)}
                disabled={deleting}
              >
                {deleteConfig.confirmModal.cancelBtn}
              </button>
              <button
                type="button"
                className={styles.modalBtnConfirm}
                onClick={handleDeleteSelf}
                disabled={deleting}
              >
                {deleting
                  ? deleteConfig.confirmModal.deletingBtn
                  : deleteConfig.confirmModal.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
