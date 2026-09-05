// @ts-nocheck
"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./WalletSection.module.css";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { auth } from "@/lib/supabaseClient";
import walletConfig from "@/data/ui/walletConfig.json";
import {
  SkeletonCircle,
  SkeletonLines,
  SkeletonButton,
  SkeletonTitle,
  SkeletonText,
} from "@/components/UI/Skeleton/Skeleton";

interface WalletSectionProps {
  profile?: any;
  onOpenBankSettings?: () => void;
}

export default function WalletSection({ profile, onOpenBankSettings }: WalletSectionProps) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const getSupabaseToken = async () => {
    const {
      data: { session },
    } = await auth.getSession();
    return session?.access_token;
  };

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSupabaseToken();
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/wallet",
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
          },
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setBalance(Number(data.balance) || 0);
        setTransactions(data.transactions || []);
      } else {
        throw new Error(data.error || walletConfig.toasts.fetchError);
      }
    } catch (error: any) {
      toast.error(error.message || walletConfig.toasts.fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();

    const handleWalletUpdated = () => {
      fetchWallet();
    };

    window.addEventListener("wallet-updated", handleWalletUpdated);
    return () => {
      window.removeEventListener("wallet-updated", handleWalletUpdated);
    };
  }, [fetchWallet]);

  const handleWithdraw = async (e: any) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || isNaN(amount)) {
      toast.error(walletConfig.toasts.invalidAmount);
      return;
    }
    if (amount > balance) {
      toast.error(walletConfig.toasts.insufficientBalance);
      return;
    }
    if (
      !profile?.bankName ||
      !profile?.bankAccountNumber ||
      !profile?.bankAccountName
    ) {
      toast.error(walletConfig.toasts.bankRequired);
      return;
    }

    setWithdrawLoading(true);
    const toastId = toast.loading(walletConfig.toasts.processing);
    try {
      const token = await getSupabaseToken();
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/wallet/withdraw",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : undefined,
          },
          body: JSON.stringify({ amount }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || walletConfig.toasts.withdrawFailed);
      }

      toast.success(walletConfig.toasts.withdrawSuccess, { id: toastId });
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      window.dispatchEvent(new CustomEvent("wallet-updated"));
      fetchWallet();
    } catch (error: any) {
      toast.error(error.message || walletConfig.toasts.withdrawFailed, {
        id: toastId,
      });
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handlePresetSelect = (presetValue: number | string) => {
    if (presetValue === "all") {
      setWithdrawAmount(String(Math.floor(balance)));
    } else {
      setWithdrawAmount(String(presetValue));
    }
  };

  const formatRupiah = (number: any) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(number) || 0);

  const getStatusClass = (status: string) => {
    switch (status) {
      case "completed":
        return styles.status_completed;
      case "pending":
        return styles.status_pending;
      case "failed":
        return styles.status_failed;
      case "rejected":
        return styles.status_rejected;
      default:
        return styles.status_default;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap = walletConfig.status as Record<string, string>;
    return statusMap[status] || status;
  };

  const getTransactionTypeText = (type: string) => {
    const typeMap = walletConfig.types as Record<string, string>;
    return typeMap[type] || (type === "refund" ? "Pengembalian Dana" : "Penarikan Dana");
  };

  const hasBankInfo = Boolean(
    profile?.bankName && profile?.bankAccountNumber && profile?.bankAccountName,
  );

  return (
    <div className={styles.walletContainer}>
      {/* 1. Balance Card */}
      <div className={styles.balanceCard}>
        {loading ? (
          <div className={styles.skeletonBalanceCard}>
            <SkeletonText width={110} height={16} />
            <SkeletonTitle width={200} height={36} />
            <SkeletonButton width={130} height={42} radius={10} />
          </div>
        ) : (
          <>
            <div className={styles.balanceHeader}>
              <AppIcon name="wallet" size={20} className={styles.walletIcon} />
              <span>{walletConfig.balance.title}</span>
            </div>
            <div className={styles.balanceAmount}>{formatRupiah(balance)}</div>
            <button
              className={styles.withdrawBtn}
              onClick={() => setIsWithdrawModalOpen(true)}
              disabled={loading || balance <= 0}
            >
              <AppIcon name="arrow-up-right" size={16} />
              <span>{walletConfig.balance.withdrawBtn}</span>
            </button>
          </>
        )}
      </div>

      {/* 2. Transactions Section */}
      <div className={styles.transactionsSection}>
        <h3 className={styles.transactionsTitle}>{walletConfig.transactions.title}</h3>
        {loading ? (
          <div className={styles.skeletonList}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`trx-skel-${i}`} className={styles.skeletonItem}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <SkeletonCircle size={44} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                    <SkeletonLines lines={2} widths={["55%", "35%"]} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                  <SkeletonText width={90} height={18} />
                  <SkeletonText width={65} height={16} radius={20} />
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <AppIcon name="file-text" size={40} className={styles.emptyIcon} />
            <p>{walletConfig.transactions.empty}</p>
          </div>
        ) : (
          <div className={styles.transactionsList}>
            {transactions.map((trx: any) => {
              const amountNum = parseFloat(trx.amount) || 0;
              const formattedAmount = `${trx.type === "refund" ? "+" : "-"} ${formatRupiah(amountNum)}`;

              return (
                <div key={trx.id} className={styles.transactionItem}>
                  <div className={styles.transactionLeft}>
                    <div
                      className={styles.transactionIconWrapper}
                      data-type={trx.type}
                    >
                      <AppIcon
                        name={
                          trx.type === "refund"
                            ? "corner-down-left"
                            : "arrow-up-right"
                        }
                        size={18}
                      />
                    </div>
                    <div className={styles.transactionInfo}>
                      <span className={styles.transactionType}>
                        {getTransactionTypeText(trx.type)}
                      </span>
                      <span className={styles.transactionDate}>
                        {new Date(trx.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {trx.description && (
                        <span className={styles.transactionDesc}>
                          {trx.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.transactionRight}>
                    <span
                      className={styles.transactionAmount}
                      data-type={trx.type}
                    >
                      {formattedAmount}
                    </span>
                    <span
                      className={`${styles.transactionStatus} ${getStatusClass(
                        trx.status,
                      )}`}
                    >
                      {getStatusText(trx.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Withdraw Modal */}
      {isWithdrawModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsWithdrawModalOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>{walletConfig.modal.title}</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setIsWithdrawModalOpen(false)}
                aria-label={walletConfig.modal.closeTitle}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            {!hasBankInfo ? (
              <div className={styles.warningBox}>
                <AppIcon
                  name="alert-triangle"
                  size={22}
                  className={styles.warningIcon}
                />
                <div className={styles.warningContent}>
                  <p>{walletConfig.modal.bankMissing.warning}</p>
                  {onOpenBankSettings && (
                    <button
                      type="button"
                      className={styles.warningActionBtn}
                      onClick={() => {
                        setIsWithdrawModalOpen(false);
                        onOpenBankSettings();
                      }}
                    >
                      {walletConfig.modal.bankMissing.actionBtn}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleWithdraw}>
                <div className={styles.bankInfoPreview}>
                  <div className={styles.bankInfoItem}>
                    <span className={styles.bankInfoLabel}>
                      {walletConfig.modal.bankLabels.bank}
                    </span>
                    <span className={styles.bankInfoValue}>
                      {profile.bankName}
                    </span>
                  </div>
                  <div className={styles.bankInfoItem}>
                    <span className={styles.bankInfoLabel}>
                      {walletConfig.modal.bankLabels.account}
                    </span>
                    <span className={styles.bankInfoValue}>
                      {profile.bankAccountNumber}
                    </span>
                  </div>
                  <div className={styles.bankInfoItem}>
                    <span className={styles.bankInfoLabel}>
                      {walletConfig.modal.bankLabels.holder}
                    </span>
                    <span className={styles.bankInfoValue}>
                      {profile.bankAccountName}
                    </span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>{walletConfig.modal.form.amountLabel}</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={balance}
                    placeholder={walletConfig.modal.form.amountPlaceholder}
                    required
                  />
                  <small>
                    {walletConfig.modal.form.availablePrefix}
                    {formatRupiah(balance)}
                  </small>

                  {Array.isArray(walletConfig.presets) &&
                    walletConfig.presets.length > 0 && (
                      <div className={styles.quickPresetsWrapper}>
                        <span className={styles.quickSelectLabel}>
                          {walletConfig.modal.form.quickSelectLabel}
                        </span>
                        <div className={styles.presetChipsRow}>
                          {walletConfig.presets.map((preset) => {
                            const isSelected =
                              preset.value === "all"
                                ? withdrawAmount === String(Math.floor(balance))
                                : withdrawAmount === String(preset.value);

                            return (
                              <button
                                key={preset.label}
                                type="button"
                                className={`${styles.presetChip} ${
                                  isSelected ? styles.presetChipActive : ""
                                }`}
                                onClick={() => handlePresetSelect(preset.value)}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => setIsWithdrawModalOpen(false)}
                  >
                    {walletConfig.modal.buttons.cancel}
                  </button>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={withdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0}
                  >
                    {withdrawLoading
                      ? walletConfig.modal.buttons.processing
                      : walletConfig.modal.buttons.submit}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
