// @ts-nocheck
import React from "react";
import styles from "./UserProfil.module.css";
import { useScrollLock } from "@/hooks/useScrollLock";
import { BiteshipAreaSelect } from "@/components/UI/BiteshipAreaSelect/BiteshipAreaSelect";

export function EditProfileModal({
  isOpen,
  onClose,
  profileConfig,
  tempProfile,
  setTempProfile,
  handleUsernameChange,
  handleImageUpload,
  handleRemoveAvatar,
  handleSaveProfile,
  uploadingImage,
  removingImage,
  loading,
}) {
  useScrollLock(Boolean(isOpen));
  if (!isOpen) return null;

  const cfg = profileConfig.modals.editProfile;
  const bankCfg = cfg.bank || {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{cfg.title}</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>
        <form onSubmit={handleSaveProfile}>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.avatarLabel}</label>
            <div className={styles.avatarUpload}>
              <div className={`${styles.avatar} ${styles.avatarUploadPreview}`}>
                {tempProfile.photoURL ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={tempProfile.photoURL} alt="Avatar" />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage || removingImage}
                className={styles.fileUploadHidden}
              />
              <label
                htmlFor="avatar-upload"
                className={`${styles.actionBtnOutline} ${styles.cursorPointer}`}
              >
                {cfg.selectImage}
              </label>
              {tempProfile.photoURL && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingImage || removingImage}
                  className={styles.actionBtnDanger}
                >
                  {cfg.removeImage}
                </button>
              )}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.username}</label>
            <div className={styles.inputWithPrefix}>
              <span>@</span>
              <input
                type="text"
                value={tempProfile.username || ""}
                onChange={handleUsernameChange}
                required
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.fullName}</label>
            <input
              type="text"
              value={tempProfile.fullName || ""}
              onChange={(e) => setTempProfile({ ...tempProfile, fullName: e.target.value })}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.phone}</label>
            <input
              type="text"
              value={tempProfile.phone || ""}
              onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.birthDate}</label>
            <input
              type="date"
              value={tempProfile.birthDate || ""}
              onChange={(e) => setTempProfile({ ...tempProfile, birthDate: e.target.value })}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.gender}</label>
            <select
              value={tempProfile.gender || ""}
              onChange={(e) => setTempProfile({ ...tempProfile, gender: e.target.value })}
              className={styles.formSelect}
            >
              <option value="">{cfg.genderOptions.placeholder}</option>
              <option value="Male">{cfg.genderOptions.male}</option>
              <option value="Female">{cfg.genderOptions.female}</option>
            </select>
          </div>
          <div className={styles.formGroupCheckbox}>
            <input
              type="checkbox"
              id="newsletter"
              checked={tempProfile.newsletterSubscribed ?? true}
              onChange={(e) => setTempProfile({ ...tempProfile, newsletterSubscribed: e.target.checked })}
            />
            <label htmlFor="newsletter">{cfg.newsletterLabel}</label>
          </div>

          <div className={styles.bankSectionWrapper}>
            <h4 className={styles.bankSectionTitle}>
              {bankCfg.title || "Informasi Rekening Bank (Untuk Penarikan Dana)"}
            </h4>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                {bankCfg.bankName || "Nama Bank"}
              </label>
              <input
                type="text"
                value={tempProfile.bankName || ""}
                onChange={(e) => setTempProfile({ ...tempProfile, bankName: e.target.value })}
                className={styles.formInput}
                placeholder={bankCfg.bankNamePlaceholder || "Contoh: BCA, Mandiri, BRI"}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                {bankCfg.accountNumber || "Nomor Rekening"}
              </label>
              <input
                type="text"
                value={tempProfile.bankAccountNumber || ""}
                onChange={(e) => setTempProfile({ ...tempProfile, bankAccountNumber: e.target.value })}
                className={styles.formInput}
                placeholder={bankCfg.accountNumberPlaceholder || "Masukkan nomor rekening valid"}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                {bankCfg.accountName || "Nama Pemilik Rekening"}
              </label>
              <input
                type="text"
                value={tempProfile.bankAccountName || ""}
                onChange={(e) => setTempProfile({ ...tempProfile, bankAccountName: e.target.value })}
                className={styles.formInput}
                placeholder={bankCfg.accountNamePlaceholder || "Sesuai buku tabungan"}
              />
            </div>
          </div>
          
          <div className={styles.modalFooter}>
            <button type="button" onClick={onClose} className={styles.actionBtnOutline}>
              {cfg.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage || removingImage}
              className={styles.actionBtnPrimary}
            >
              {loading ? cfg.saving : cfg.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddressFormModal({
  isOpen,
  onClose,
  currentAddress,
  setCurrentAddress,
  handleSaveAddress,
  profileConfig,
  loading,
  verifiedPhones = [],
  profilePhone = "",
  initialPhone = "",
}) {
  if (!isOpen || !currentAddress) return null;

  const cfg = profileConfig.modals.address;
  const cleanPhone = (currentAddress.recipientPhone || "").trim();
  const isPhoneVerified =
    verifiedPhones.includes(cleanPhone) ||
    (profilePhone && profilePhone === cleanPhone) ||
    (initialPhone && initialPhone === cleanPhone);
  const isValidPhone = cleanPhone.length >= 8;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {currentAddress?.id ? cfg.editTitle : cfg.addTitle}
          </h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>
        <form onSubmit={handleSaveAddress}>
          {/* 1. Kontak Penerima */}
          <div className={styles.sectionDividerTitle}>
            👤 {cfg.recipientSection || "Kontak Penerima"}
          </div>
          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>{cfg.recipientName} *</label>
              <input
                type="text"
                value={currentAddress.recipientName}
                onChange={(e) => setCurrentAddress({ ...currentAddress, recipientName: e.target.value })}
                required
                className={styles.formInput}
                placeholder={cfg.recipientNamePlaceholder || "Nama penerima"}
              />
            </div>
            <div className={styles.formGroup}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className={styles.inputLabel} style={{ marginBottom: 0 }}>{cfg.recipientPhone} *</label>
                {isValidPhone && (
                  isPhoneVerified ? (
                    <span style={{ fontSize: "11px", color: "var(--success-color, #10b981)", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                      ✓ Terverifikasi WhatsApp
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "var(--warning-color, #f59e0b)", fontWeight: 500, display: "flex", alignItems: "center", gap: "3px" }}>
                      ⚠️ Wajib OTP saat simpan
                    </span>
                  )
                )}
              </div>
              <input
                type="text"
                value={currentAddress.recipientPhone || ""}
                onChange={(e) => setCurrentAddress({ ...currentAddress, recipientPhone: e.target.value })}
                required
                className={styles.formInput}
                placeholder={cfg.recipientPhonePlaceholder || "08xxxxxxxxxx"}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", flexWrap: "wrap", gap: "4px" }}>
                <small className={styles.inputHelpText || styles.fieldHelpText}>
                  {cfg.recipientPhoneHint || "Nomor aktif penerima untuk konfirmasi kurir saat pengiriman"}
                </small>
                {profilePhone && profilePhone !== cleanPhone && (
                  <button
                    type="button"
                    onClick={() => setCurrentAddress({ ...currentAddress, recipientPhone: profilePhone })}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary-accent)",
                      fontSize: "11px",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                      fontWeight: 600,
                    }}
                  >
                    Gunakan No. HP Profil ({profilePhone})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Wilayah Pengiriman Biteship */}
          <div className={styles.sectionDividerTitle}>
            📍 {cfg.areaSection || "Wilayah Pengiriman"}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>
              {cfg.areaLabel || "Kecamatan / Kota / Kode Pos"} *
            </label>
            <BiteshipAreaSelect
              value={{
                province: currentAddress.province,
                city: currentAddress.city,
                district: currentAddress.district,
                postalCode: currentAddress.postalCode,
                biteshipAreaId: currentAddress.cityId,
              }}
              onChange={(next: any) => setCurrentAddress((prev: any) => ({ 
                ...prev, 
                ...next,
                cityId: next.biteshipAreaId || next.cityId || prev.cityId
              }))}
            />
          </div>

          {/* 3. Alamat Lengkap & Detail Rumah */}
          <div className={styles.sectionDividerTitle}>
            🏠 {cfg.streetSection || "Alamat Lengkap & Patokan"}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.street} *</label>
            <textarea
              rows="2"
              value={currentAddress.street}
              onChange={(e) => setCurrentAddress({ ...currentAddress, street: e.target.value })}
              required
              className={styles.formTextarea}
              placeholder={cfg.streetPlaceholder || "Nama jalan, nomor rumah, RT/RW, Blok, nama gedung..."}
            />
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>{cfg.label || "Label Alamat"}</label>
              <input
                type="text"
                value={currentAddress.label || cfg.defaultLabel || "Rumah"}
                onChange={(e) => setCurrentAddress({ ...currentAddress, label: e.target.value })}
                className={styles.formInput}
                placeholder={cfg.labelPlaceholder || "Rumah / Kantor / Kos"}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>{cfg.notes || "Catatan Kurir (Opsional)"}</label>
              <input
                type="text"
                value={currentAddress.notes || ""}
                onChange={(e) => setCurrentAddress({ ...currentAddress, notes: e.target.value })}
                className={styles.formInput}
                placeholder={cfg.notesPlaceholder || "Warna pagar, titip satpam, dll"}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" onClick={onClose} className={styles.actionBtnOutline}>
              {cfg.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !currentAddress?.recipientName || !currentAddress?.recipientPhone || cleanPhone.length < 8}
              className={styles.actionBtnPrimary}
            >
              {loading
                ? cfg.saving
                : !isPhoneVerified && isValidPhone
                ? "Verifikasi & Simpan Alamat"
                : cfg.save || "Simpan Alamat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PasswordModal({
  isOpen,
  onClose,
  passwords,
  setPasswords,
  handlePasswordChange,
  profileConfig,
  isPasswordChanging,
}) {
  useScrollLock(Boolean(isOpen));
  if (!isOpen) return null;

  const cfg = profileConfig.modals.password;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{cfg.title}</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>
        <form onSubmit={handlePasswordChange}>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.current}</label>
            <input
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              className={styles.formInput}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.new}</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              className={styles.formInput}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{cfg.confirm}</label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              className={styles.formInput}
              required
            />
          </div>
          <div className={styles.modalFooter}>
            <button type="button" onClick={onClose} className={styles.actionBtnOutline}>
              {cfg.cancel}
            </button>
            <button
              type="submit"
              disabled={isPasswordChanging}
              className={styles.actionBtnPrimary}
            >
              {isPasswordChanging ? cfg.submitting : cfg.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OTPModal({
  isOpen,
  onClose,
  onSubmit,
  onResend,
  phone,
  loading,
  profileConfig,
}) {
  const [otp, setOtp] = React.useState(new Array(6).fill(""));
  const inputRefs = React.useRef([]);
  const [resendTimer, setResendTimer] = React.useState(60);

  const cfg = profileConfig?.modals?.otp || {
    title: "Verifikasi WhatsApp",
    instruction: "Masukkan 6-digit kode OTP yang telah kami kirimkan ke nomor WhatsApp",
    timerText: "Kirim Ulang Kode",
    resendBtn: "Kirim Ulang Kode OTP",
    cancel: "Batal",
    verify: "Verifikasi",
    verifying: "Memverifikasi...",
  };

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setOtp(new Array(6).fill(""));
      setResendTimer(120);
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 100);
    }
  }, [isOpen]);

  // Countdown timer
  React.useEffect(() => {
    if (!isOpen) return;
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer, isOpen]);

  const formatTime = (s: any) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  if (!isOpen) return null;

  const handleChange = (value, index: any) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    // Auto-advance
    if (digit && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index: any) => {
    if (e.key === "Backspace") {
      if (otp[index] === "" && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      } else if (otp[index] !== "") {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e: any) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pastedData) return;
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    const nextIndex = Math.min(pastedData.length, 5);
    if (inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex].focus();
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length === 6) {
      onSubmit(otpString);
    }
  };

  const handleResend = () => {
    setOtp(new Array(6).fill(""));
    setResendTimer(60);
    if (onResend) onResend(phone);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles.otpModalContent}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{cfg.title}</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>
        <div className={styles.otpHeaderCenter}>
          <div className={styles.otpIconWrapper}>
            💬
          </div>
          <p className={styles.otpInstruction}>
            {cfg.instruction} <b className={styles.otpPhoneBold}>{phone}</b>
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.otpInputsGrid}>
            {otp.map((data, index) => (
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="1"
                key={index}
                value={data}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={handlePaste}
                ref={(ref) => inputRefs.current[index] = ref}
                disabled={loading}
                autoComplete="one-time-code"
                className={styles.otpDigitInput}
              />
            ))}
          </div>

          {/* Timer / Resend */}
          <div className={styles.otpTimerBox}>
            {resendTimer > 0 ? (
              <span>{cfg.timerText} ({formatTime(resendTimer)})</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className={styles.otpResendBtn}
              >
                {cfg.resendBtn}
              </button>
            )}
          </div>

          <div className={`${styles.modalFooter} ${styles.otpFooter}`}>
            <button 
              type="button" 
              onClick={onClose} 
              className={`${styles.actionBtnOutline} ${styles.otpFooterBtn}`} 
              disabled={loading}
            >
              {cfg.cancel}
            </button>
            <button 
              type="submit" 
              disabled={loading || otp.join("").length !== 6} 
              className={`${styles.actionBtnPrimary} ${styles.otpFooterBtn}`}
            >
              {loading ? cfg.verifying : cfg.verify}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}