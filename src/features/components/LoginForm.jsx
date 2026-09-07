"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import loginConfig from "@/data/ui/loginConfig.json";
import styles from "./LoginForm.module.css";
import { useStore } from "@/context/StoreContext";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSafeAuthRedirect } from "@/utils/authRedirect";
import Script from "next/script";

export default function LoginForm() {
  const { setCustomer } = useStore();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeAuthRedirect(searchParams.get("callbackUrl"));

  const { form } = loginConfig || {};
  const {
    settings = {},
    labels = {},
    buttons = {},
    validation = {},
    messages = {},
    defaults = {},
    googleAuth = {},
    fields = [],
  } = form || {};

  const cooldownSeconds = Number(settings.resendCooldownSeconds) || 120;
  const otpLength = Number(settings.otpLength) || 6;

  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedEmail = localStorage.getItem("rememberedEmail");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (e) {
      console.error("Gagal membaca rememberedEmail:", e);
    }
  }, []);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpArray, setOtpArray] = useState(Array(otpLength).fill(""));
  const inputRefs = useRef([]);

  // Timer State
  const [resendTimer, setResendTimer] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Resend Timer Logic
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const formatTime = (timeInSeconds) => {
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, "0");
    const s = (timeInSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Helper untuk mengecek role di database dan melakukan redirect yang sesuai
  const handlePostLoginRedirect = useCallback(async (userId) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      let isAdmin = false;
      if (!profileError && profile?.role) {
        isAdmin = ["admin", "superadmin"].includes(String(profile.role).toLowerCase());
      }
      
      if (!isAdmin) {
        const { data: { session } } = await supabase.auth.getSession();
        const metaRole = session?.user?.user_metadata?.role;
        if (metaRole) {
          isAdmin = ["admin", "superadmin"].includes(String(metaRole).toLowerCase());
        }
      }

      if (isAdmin) {
        window.location.replace("/dashboard");
      } else {
        window.location.replace(callbackUrl);
      }
    } catch (err) {
      console.error("Gagal memeriksa role:", err);
      window.location.replace(callbackUrl);
    }
  }, [callbackUrl]);

  // ==========================================
  // GOOGLE CREDENTIAL RESPONSE HANDLER (POPUP)
  // ==========================================
  const handleGoogleCredentialResponse = useCallback(async (response) => {
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const idToken = response.credential;
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (signInError) throw signInError;

      setCustomer({
        name: data.user?.user_metadata?.name || defaults.googleFallbackName || "User Google",
        email: data.user?.email,
        phone: data.user?.user_metadata?.phone || "",
      });

      await handlePostLoginRedirect(data.user.id);
    } catch (err) {
      setError(err.message || messages.googleAuthFailed || "Gagal masuk menggunakan Google.");
      setIsLoading(false);
    }
  }, [handlePostLoginRedirect, setCustomer, defaults.googleFallbackName, messages.googleAuthFailed]);

  const initGoogleButton = useCallback(() => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (googleClientId && window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
      });

      const buttonElement = document.getElementById("googleButtonDiv");
      if (buttonElement) {
        buttonElement.innerHTML = "";
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const theme = isDark ? "filled_black" : (googleAuth.theme || "outline");
        
        window.google.accounts.id.renderButton(buttonElement, {
          theme,
          size: googleAuth.size || "large",
          text: googleAuth.text || "continue_with",
          shape: googleAuth.shape || "rectangular",
          width: Math.min(buttonElement.offsetWidth || 340, 360),
        });
      }
    }
  }, [handleGoogleCredentialResponse, googleAuth]);

  useEffect(() => {
    if (!otpSent) {
      const timer = setTimeout(initGoogleButton, 200);
      return () => clearTimeout(timer);
    }
  }, [otpSent, initGoogleButton]);

  // ==========================================
  // OTP BOX HANDLERS & AUTO-SUBMIT
  // ==========================================
  const handleVerifyOtp = useCallback(async (codeToVerify) => {
    const otpCode = codeToVerify || otpArray.join("");
    if (otpCode.length < otpLength) {
      setError(validation.otpLengthRequired || `Silakan masukkan kode OTP ${otpLength} digit.`);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode,
        type: "email",
      });

      if (verifyError) throw verifyError;

      let userName = data.user?.user_metadata?.name;
      // Jika user baru dan tidak punya nama, gunakan nama depan dari email
      if (!userName) {
        userName = email.split("@")[0];
        await supabase.auth.updateUser({
          data: { name: userName, role: "customer" },
        });
      }

      setCustomer({
        name: userName,
        email: data.user?.email,
        phone: data.user?.user_metadata?.phone || "",
      });

      try {
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }
      } catch (e) {
        console.error("Gagal memperbarui rememberedEmail:", e);
      }

      setSuccessMessage(messages.loginSuccess || "Berhasil masuk! Mengalihkan...");
      await handlePostLoginRedirect(data.user.id);
    } catch (err) {
      const errMsg = err?.message || "";
      if (errMsg.includes("expired") || errMsg.includes("invalid") || errMsg.includes("Token")) {
        setError(messages.invalidOtp || "Kode OTP salah atau telah kedaluwarsa. Silakan minta kode baru.");
      } else {
        setError(errMsg || messages.otpFailed || "Kode OTP salah atau gagal diverifikasi.");
      }
      setIsLoading(false);
    }
  }, [email, otpArray, otpLength, rememberMe, setCustomer, handlePostLoginRedirect, validation.otpLengthRequired, messages.invalidOtp, messages.otpFailed, messages.loginSuccess]);

  const handleOtpChange = (index, value) => {
    // Hanya terima satu digit angka
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtpArray = [...otpArray];
    newOtpArray[index] = digit;
    setOtpArray(newOtpArray);

    // Auto-advance ke kotak berikutnya
    if (digit && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit bila ke-6 digit sudah terisi semua
    if (digit && newOtpArray.every((d) => d !== "")) {
      handleVerifyOtp(newOtpArray.join(""));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpArray[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, otpLength).split("");
    if (pasteData.length > 0) {
      const newOtpArray = [...otpArray];
      pasteData.forEach((char, i) => {
        if (i < otpLength) {
          newOtpArray[i] = char;
        }
      });
      setOtpArray(newOtpArray);

      const nextEmptyIndex = newOtpArray.findIndex((val) => val === "");
      if (nextEmptyIndex !== -1) {
        inputRefs.current[nextEmptyIndex]?.focus();
      } else {
        inputRefs.current[otpLength - 1]?.focus();
      }

      if (newOtpArray.every((d) => d !== "")) {
        handleVerifyOtp(newOtpArray.join(""));
      }
    }
  };

  const requestOtpCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError(validation.invalidEmail || "Masukkan alamat email yang valid.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (signInError) throw signInError;
      
      setSuccessMessage(messages.otpSentSuccess || "Kode OTP telah dikirim ke email Anda. Silakan periksa kotak masuk (atau spam).");
      setOtpSent(true);
      setResendTimer(cooldownSeconds);
    } catch (err) {
      const errMsg = err?.message || "";
      if (errMsg.includes("rate_limit") || err?.status === 429) {
        setError(messages.tooManyRequests || "Terlalu banyak permintaan OTP. Mohon tunggu 1 menit sebelum mencoba lagi.");
      } else {
        setError(errMsg || messages.otpRequestFailed || "Gagal mengirim kode OTP. Pastikan email valid.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // MAIN SUBMIT HANDLER
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError(validation.emailRequired || "Email wajib diisi.");
      return;
    }

    if (!otpSent) {
      await requestOtpCode();
    } else {
      await handleVerifyOtp();
    }
  };

  const emailPlaceholder = fields.find((f) => f.name === "email")?.placeholder || form?.emailPlaceholder || "EMAIL ADDRESS";

  return (
    <div className={styles.formWrapper}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogleButton}
      />

      <div className={styles.loginCard}>
        <h2 className={styles.loginTitle}>{form?.title || "WELCOME BACK"}</h2>

        {!otpSent && (
          <>
            <div className={styles.socialWrapper}>
              <div id="googleButtonDiv" className={styles.googleBtnWrapper}></div>
            </div>

            <div className={styles.divider}>
              <span>{labels.oauthDivider || "ATAU LANJUTKAN DENGAN EMAIL"}</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

          {/* Email Field */}
          {!otpSent && (
            <div className={styles.inputWrapper}>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder={emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.inputField}
                disabled={isLoading}
                required
              />
            </div>
          )}

          {/* OTP Field */}
          <div className={`${styles.inputWrapper} ${otpSent ? styles.fieldVisible : styles.fieldHidden}`}>
            {otpSent && (
              <p className={styles.otpNoticeText}>
                {labels.otpNoticePrefix || "Masukkan kode yang dikirim ke"} <br />
                <strong className={styles.otpNoticeEmail}>{email}</strong>
              </p>
            )}
            <div className={styles.otpContainer}>
              {otpArray.map((digit, index) => (
                <input
                  key={index}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  ref={(el) => (inputRefs.current[index] = el)}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  className={styles.otpInputBox}
                  disabled={isLoading || !otpSent}
                  autoComplete="one-time-code"
                  suppressHydrationWarning
                />
              ))}
            </div>
          </div>

          {!otpSent && isClient && (
            <div className={`${styles.optionsRow} ${styles.optionsRowLeft}`}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span className={styles.customCheckmark}></span>
                {labels.rememberMe || "Remember Me"}
              </label>
            </div>
          )}

          <button
            type="submit"
            className={`${styles.btnLogin} ${isLoading ? styles.btnLoading : ""}`}
            disabled={isLoading || (otpSent && otpArray.join("").length < otpLength)}
          >
            {isLoading ? (
              <span className={styles.spinner}></span>
            ) : !otpSent ? (
              buttons.sendOtp || "KIRIM KODE OTP"
            ) : (
              buttons.verifyOtp || "VERIFIKASI OTP"
            )}
          </button>

          {otpSent && (
            <>
              {resendTimer > 0 ? (
                <span className={styles.resendTimerText}>
                  {labels.resendCountdown
                    ? labels.resendCountdown.replace("{time}", formatTime(resendTimer))
                    : `Kirim Ulang Kode (${formatTime(resendTimer)})`}
                </span>
              ) : (
                <button
                  type="button"
                  className={`${styles.switchModeBtn} ${styles.resendOtpBtn}`}
                  onClick={requestOtpCode}
                  disabled={isLoading}
                >
                  {buttons.resendOtp || "Kirim Ulang Kode OTP"}
                </button>
              )}

              <button
                type="button"
                className={`${styles.switchModeBtn} ${styles.changeEmailBtn}`}
                onClick={() => {
                  setOtpSent(false);
                  setOtpArray(Array(otpLength).fill(""));
                  setResendTimer(0);
                  setError("");
                  setSuccessMessage("");
                }}
                disabled={isLoading}
              >
                {buttons.changeEmail || "Ubah Alamat Email"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
