"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import loginConfig from "@/data/ui/loginConfig.json";
import styles from "./LoginForm.module.css";
import { useStore } from "@/context/StoreContext";
import { useSearchParams } from "next/navigation";
import { mamekoClient } from "@/lib/mamekoClient";
import { getSafeAuthRedirect } from "@/utils/authRedirect";
import { sanitizeUserError } from "@/utils/errorSanitizer";
import Script from "next/script";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginForm() {
  const { setCustomer } = useStore();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeAuthRedirect(searchParams?.get("callbackUrl"));

  const { form } = loginConfig || {};
  const {
    settings = { resendCooldownSeconds: 120, otpLength: 6 },
    labels = {},
    buttons = {},
    validation = {},
    messages = {},
    defaults = {},
    googleAuth = {},
    fields = [],
  } = (form as any) || {};

  const cooldownSeconds = Number(settings?.resendCooldownSeconds) || 120;
  const otpLength = Number(settings?.otpLength) || 6;

  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
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
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpArray, setOtpArray] = useState<string[]>(Array(otpLength).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isVerifyingRef = useRef(false);

  // Timer State
  const [resendTimer, setResendTimer] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Resend Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0 && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  const formatTime = (timeInSeconds: number) => {
    const m = Math.floor(timeInSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (timeInSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Helper untuk mengecek role di database dan melakukan redirect yang sesuai
  const handlePostLoginRedirect = useCallback(
    async (userId: string) => {
      try {
        let isAdmin = false;

        if (userId) {
          const { data: profile, error: profileError } = await mamekoClient
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

          if (!profileError && profile?.role) {
            isAdmin = ["admin", "superadmin"].includes(
              String(profile.role).toLowerCase()
            );
          }
        }

        if (!isAdmin) {
          const {
            data: { session },
          } = await mamekoClient.auth.getSession();
          const metaRole =
            session?.user?.user_metadata?.role || session?.user?.role;
          if (metaRole) {
            isAdmin = ["admin", "superadmin"].includes(
              String(metaRole).toLowerCase()
            );
          }
        }

        const targetUrl = isAdmin ? "/dashboard" : callbackUrl;

        if (typeof window !== "undefined") {
          window.location.replace(targetUrl);
          // Fallback navigasi jika replace ditahan oleh browser
          setTimeout(() => {
            if (window.location.pathname !== targetUrl) {
              window.location.href = targetUrl;
            }
          }, 350);
        }
      } catch (err) {
        console.error("Gagal memeriksa role:", err);
        if (typeof window !== "undefined") {
          window.location.replace(callbackUrl);
        }
      }
    },
    [callbackUrl]
  );

  // ==========================================
  // GOOGLE CREDENTIAL RESPONSE HANDLER (POPUP)
  // ==========================================
  const handleGoogleCredentialResponse = useCallback(
    async (response: any) => {
      setError("");
      setSuccessMessage("");
      setIsLoading(true);

      try {
        const idToken = response?.credential;
        if (!idToken) {
          throw new Error(
            messages?.googleAuthFailed || "Token Google tidak ditemukan."
          );
        }

        const { data, error: signInError } =
          await mamekoClient.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });

        if (signInError) throw signInError;

        if (data?.user) {
          const userId = data.user.id || "";
          setCustomer({
            name:
              data.user?.user_metadata?.name ||
              data.user?.full_name ||
              defaults?.googleFallbackName ||
              "User Google",
            email: data.user?.email || "",
            phone: data.user?.user_metadata?.phone || data.user?.phone || "",
          });

          await handlePostLoginRedirect(userId);
        }
      } catch (err: any) {
        const safeError = sanitizeUserError(
          err,
          messages?.googleAuthFailed || "Gagal masuk menggunakan Google."
        );
        if (isMountedRef.current) {
          setError(safeError);
          setIsLoading(false);
        }
      }
    },
    [
      handlePostLoginRedirect,
      setCustomer,
      defaults?.googleFallbackName,
      messages?.googleAuthFailed,
    ]
  );

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
        const isDark =
          document.documentElement.getAttribute("data-theme") === "dark";
        const theme = isDark
          ? "filled_black"
          : googleAuth?.theme || "outline";

        window.google.accounts.id.renderButton(buttonElement, {
          theme,
          size: googleAuth?.size || "large",
          text: googleAuth?.text || "continue_with",
          shape: googleAuth?.shape || "rectangular",
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
  const handleVerifyOtp = useCallback(
    async (codeToVerify?: string) => {
      if (isVerifyingRef.current) return;

      const otpCode = codeToVerify || otpArray.join("");
      if (otpCode.length < otpLength) {
        setError(
          validation?.otpLengthRequired ||
            `Silakan masukkan kode OTP ${otpLength} digit.`
        );
        return;
      }

      isVerifyingRef.current = true;
      setError("");
      setIsLoading(true);

      try {
        const { data, error: verifyError } = await mamekoClient.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: otpCode,
          type: "email",
        });

        if (verifyError) throw verifyError;

        const userId =
          data?.user?.id ||
          data?.session?.user?.id ||
          "";

        const userName =
          data?.user?.user_metadata?.name ||
          data?.user?.full_name ||
          email.split("@")[0] ||
          "User";

        setCustomer({
          name: userName,
          email: data?.user?.email || email,
          phone: data?.user?.user_metadata?.phone || data?.user?.phone || "",
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

        setSuccessMessage(
          messages?.loginSuccess || "Berhasil masuk! Mengalihkan..."
        );
        await handlePostLoginRedirect(userId);
      } catch (err: any) {
        const safeError = sanitizeUserError(
          err,
          messages?.otpFailed || "Kode OTP salah atau gagal diverifikasi."
        );
        if (isMountedRef.current) {
          setError(safeError);
          setIsLoading(false);
        }
        isVerifyingRef.current = false;
      }
    },
    [
      email,
      otpArray,
      otpLength,
      rememberMe,
      setCustomer,
      handlePostLoginRedirect,
      validation?.otpLengthRequired,
      messages?.otpFailed,
      messages?.loginSuccess,
    ]
  );

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtpArray = [...otpArray];
    newOtpArray[index] = digit;
    setOtpArray(newOtpArray);

    if (digit && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && newOtpArray.every((d) => d !== "")) {
      handleVerifyOtp(newOtpArray.join(""));
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpArray[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, otpLength)
      .split("");
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
      setError(validation?.invalidEmail || "Masukkan alamat email yang valid.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { error: signInError } = await mamekoClient.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (signInError) throw signInError;

      setSuccessMessage(
        messages?.otpSentSuccess ||
          "Kode OTP telah dikirim ke email Anda. Silakan periksa kotak masuk (atau spam)."
      );
      setOtpSent(true);
      setResendTimer(cooldownSeconds);
    } catch (err: any) {
      const safeError = sanitizeUserError(
        err,
        messages?.otpRequestFailed ||
          "Gagal mengirim kode OTP. Pastikan email valid."
      );
      setError(safeError);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // MAIN SUBMIT HANDLER
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError(validation?.emailRequired || "Email wajib diisi.");
      return;
    }

    if (!otpSent) {
      await requestOtpCode();
    } else {
      await handleVerifyOtp();
    }
  };

  const emailPlaceholder =
    fields?.find((f: any) => f.name === "email")?.placeholder ||
    form?.emailPlaceholder ||
    "EMAIL ADDRESS";

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
              <div
                id="googleButtonDiv"
                className={styles.googleBtnWrapper}
              ></div>
            </div>

            <div className={styles.divider}>
              <span>
                {labels?.oauthDivider || "ATAU LANJUTKAN DENGAN EMAIL"}
              </span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && (
            <div className={styles.successMessage}>{successMessage}</div>
          )}

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
          <div
            className={`${styles.inputWrapper} ${
              otpSent ? styles.fieldVisible : styles.fieldHidden
            }`}
          >
            {otpSent && (
              <p className={styles.otpNoticeText}>
                {labels?.otpNoticePrefix || "Masukkan kode yang dikirim ke"}{" "}
                <br />
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
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
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
                {labels?.rememberMe || "Remember Me"}
              </label>
            </div>
          )}

          <button
            type="submit"
            className={`${styles.btnLogin} ${
              isLoading ? styles.btnLoading : ""
            }`}
            disabled={
              isLoading || (otpSent && otpArray.join("").length < otpLength)
            }
          >
            {isLoading ? (
              <span className={styles.spinner}></span>
            ) : !otpSent ? (
              buttons?.sendOtp || "KIRIM KODE OTP"
            ) : (
              buttons?.verifyOtp || "VERIFIKASI OTP"
            )}
          </button>

          {otpSent && (
            <>
              {resendTimer > 0 ? (
                <span className={styles.resendTimerText}>
                  {labels?.resendCountdown
                    ? labels.resendCountdown.replace(
                        "{time}",
                        formatTime(resendTimer)
                      )
                    : `Kirim Ulang Kode (${formatTime(resendTimer)})`}
                </span>
              ) : (
                <button
                  type="button"
                  className={`${styles.switchModeBtn} ${styles.resendOtpBtn}`}
                  onClick={requestOtpCode}
                  disabled={isLoading}
                >
                  {buttons?.resendOtp || "Kirim Ulang Kode OTP"}
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
                {buttons?.changeEmail || "Ubah Alamat Email"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

