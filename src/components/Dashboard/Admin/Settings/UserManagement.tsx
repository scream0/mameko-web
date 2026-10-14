// @ts-nocheck
"use client";
import { getApiBaseUrl } from "@/lib/apiClient";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import styles from "./UserManagement.module.css";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import config from "@/data/ui/userManagementConfig.json";
import { TableSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

function formatDate(value: any) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const money = (value: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const lastUserIdRef = useRef(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No active session found.");

      const res = await fetch(getApiBaseUrl() + "/api/admin/team", {
        headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
        cache: "no-store"
      });
      const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(result.error || "Gagal memuat data pengguna.");
      setUsers(result.users || []);
    } catch (err) {
      console.error("Gagal memuat user:", err);
      toast.error(config.toasts.fetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkAuthAndLoad() {
      const { data: { session } } = await supabase.auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      if (session) {
        await loadUsers();
      } else {
        setLoading(false);
      }
    }

    checkAuthAndLoad();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (shouldSkipAuthEvent(event, session, lastUserIdRef.current)) return;
      lastUserIdRef.current = session?.user?.id || null;
      
      if (session) {
        await loadUsers();
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateUser = async (userId, payload: any) => {
    try {
      setUpdatingId(userId);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(getApiBaseUrl() + "/api/admin/team", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, ...payload }),
      });
      const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan perubahan.");

      // Update state lokal
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, ...payload } : u,
        ),
      );

      if (payload.status === "blocked") {
        toast.success(config.toasts.blockSuccess);
      } else if (payload.status === "active") {
        toast.success(config.toasts.activateSuccess);
      } else {
        toast.success(config.toasts.updateSuccess);
      }
      return true;
    } catch (err) {
      console.error("Gagal update user:", err);
      toast.error(err.message || config.toasts.updateError);
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRoleChange = async (user, newRole: any) => {
    if (user.role === newRole) return;
    await updateUser(user.id, { role: newRole });
  };

  const handleToggleStatus = async (user: any) => {
    const isBlocking = user.status !== "blocked";
    setConfirmTarget({ user, isBlocking });
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget) return;
    const { user, isBlocking } = confirmTarget;
    const success = await updateUser(user.id, {
      status: isBlocking ? "blocked" : "active",
    });
    if (success) setConfirmTarget(null);
  };

  const handleDeleteUser = (user: any) => {
    setDeleteTarget(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    const targetUserId = deleteTarget.id;
    try {
      setDeletingId(targetUserId);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let deletionSucceeded = false;

      // 1. Coba hapus via Golang backend API (termasuk auth.users via service_role)
      try {
        const res = await fetch(getApiBaseUrl() + "/api/admin/team", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: targetUserId }),
        });
        // Fix #2: validasi response body, jangan hanya cek res.ok
        // Karena beberapa Go handler mengembalikan 200 tapi dengan error payload
        let result: any = {};
        try {
          const ct = res.headers?.get("content-type") || "";
          if (ct.includes("application/json")) result = await res.json();
        } catch (_) { /* body kosong / non-JSON, abaikan */ }

        if (res.ok && result?.success !== false && !result?.error) {
          deletionSucceeded = true;
          console.info("[DeleteUser] Berhasil via Go API:", targetUserId);
        } else {
          console.warn(
            "[DeleteUser] Go API OK tapi response menunjukkan gagal:",
            res.status,
            result,
          );
        }
      } catch (apiErr) {
        console.warn("[DeleteUser] API DELETE /api/admin/team gagal, coba Supabase RPC:", apiErr);
      }

      // 2. Fallback via Supabase RPC jika Go API gagal atau belum menghandle auth.users
      if (!deletionSucceeded) {
        console.info("[DeleteUser] Mencoba RPC delete_user_by_admin...");
        const { data: rpcData, error: rpcError } = await supabase.rpc("delete_user_by_admin", {
          target_user_id: targetUserId,
        });
        if (!rpcError) {
          deletionSucceeded = true;
          const deletedFromAuth = rpcData?.deleted_from_auth ?? rpcData;
          if (!deletedFromAuth) {
            console.warn(
              "[DeleteUser] Berhasil via RPC tapi auth.users belum terhapus — Go backend perlu menggunakan Supabase Admin API.",
            );
          } else {
            console.info("[DeleteUser] Berhasil sepenuhnya via Supabase RPC:", targetUserId);
          }
        } else {
          console.warn("[DeleteUser] RPC gagal:", rpcError.message, "— mencoba hapus profiles langsung...");
          // Fallback: hapus dari public.profiles saja (auth.users tetap ada, tapi user tidak muncul di list)
          const { error: profileDelError } = await supabase
            .from("profiles")
            .delete()
            .eq("id", targetUserId);
          if (!profileDelError) {
            deletionSucceeded = true;
            console.warn(
              "[DeleteUser] Hanya profiles yang terhapus — auth.users masih ada. Hubungi admin server untuk hapus permanen.",
            );
          } else {
            throw new Error(
              rpcError?.message || profileDelError?.message || "Gagal menghapus pengguna.",
            );
          }
        }
      }

      // Fix #1: Update state lokal optimis LALU reload dari server untuk konfirmasi
      setUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      setDeleteTarget(null);
      toast.success(config.toasts.deleteSuccess);

      // Reload data dari server untuk memastikan delete benar-benar berhasil di DB
      await loadUsers();
    } catch (err: any) {
      console.error("Gagal hapus user:", err);
      toast.error(err.message || config.toasts.deleteError);
      // Rollback: reload state dari server agar tidak menampilkan data yang salah
      await loadUsers();
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (statusFilter !== "all") {
      result = result.filter((u) => u.status === statusFilter);
    }
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [users, statusFilter, roleFilter, searchQuery]);

  const summary = useMemo(() => {
    const safeStatus = (u: any) => u.status || "active";
    return {
      total: users.length,
      active: users.filter((u) => safeStatus(u) === "active").length,
      blocked: users.filter((u) => safeStatus(u) === "blocked").length,
      customers: users.filter((u) => (u.role || "customer") === "customer").length,
    };
  }, [users]);

  return (
    <div className={styles.wrapper}>
      {/* Confirmation Modal */}
      {confirmTarget && (
        <div
          className={styles.modalOverlay}
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {confirmTarget.isBlocking
                  ? config.confirm.blockTitle
                  : config.confirm.activateTitle}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>
            <p className={styles.modalMessage}>
              {(confirmTarget.isBlocking
                ? config.confirm.blockMessage
                : config.confirm.activateMessage
              ).replace("{name}", confirmTarget.user.name)}
            </p>
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className={styles.cancelBtn}
              >
                {config.confirm.cancel}
              </button>
              <button
                type="button"
                onClick={confirmToggleStatus}
                disabled={updatingId === confirmTarget.user.id}
                className={
                  confirmTarget.isBlocking ? styles.dangerBtn : styles.confirmBtn
                }
              >
                {updatingId === confirmTarget.user.id
                  ? config.actions.saving
                  : config.confirm.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteTarget && (
        <div
          className={styles.modalOverlay}
          onClick={() => !deletingId && setDeleteTarget(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={`${styles.modalTitle} ${styles.modalDangerTitle}`}>
                {config.confirm.deleteTitle}
              </h3>
              <button
                type="button"
                onClick={() => !deletingId && setDeleteTarget(null)}
                className={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>
            <p className={styles.modalMessage}>
              {config.confirm.deleteMessage.replace(
                "{name}",
                deleteTarget.name || deleteTarget.email || config.confirm.defaultTargetName
              )}
            </p>
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
                className={styles.cancelBtn}
              >
                {config.confirm.cancel}
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deletingId === deleteTarget.id}
                className={styles.dangerBtn}
              >
                {deletingId === deleteTarget.id
                  ? config.actions.deleting
                  : config.confirm.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerRow}>
          <div>
            <h3 className={styles.headerTitle}>{config.header.title}</h3>
            <p className={styles.headerSubtitle}>{config.header.subtitle}</p>
          </div>
          <div className={styles.summaryRow}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{summary.total}</span>
              <span className={styles.summaryLabel}>{config.summary.total}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValueSuccess}>{summary.active}</span>
              <span className={styles.summaryLabel}>{config.summary.active}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValueDanger}>{summary.blocked}</span>
              <span className={styles.summaryLabel}>{config.summary.blocked}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{summary.customers}</span>
              <span className={styles.summaryLabel}>{config.summary.customers}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.controlsRow}>
          <input
            type="text"
            placeholder={config.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">{config.filters.all}</option>
            <option value="active">{config.filters.active}</option>
            <option value="blocked">{config.filters.blocked}</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">{config.filters.roleAll}</option>
            <option value="admin">{config.filters.roleAdmin}</option>
            <option value="staff">{config.filters.roleStaff}</option>
            <option value="customer">{config.filters.roleCustomer}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`card ${styles.tableCard}`}>
        {loading ? (
          <div style={{ padding: "1rem 0.25rem" }}>
            <TableSkeleton headers={8} rows={6} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className={styles.stateText}>{config.emptyText}</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{config.tableHeaders.customer}</th>
                  <th>{config.tableHeaders.contact}</th>
                  <th>{config.tableHeaders.role}</th>
                  <th>{config.tableHeaders.status}</th>
                  <th>{config.tableHeaders.orders}</th>
                  <th>{config.tableHeaders.points}</th>
                  <th>{config.tableHeaders.joined}</th>
                  <th>{config.tableHeaders.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.customerCell}>
                        <div className={styles.avatar}>
                          {String(user.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className={styles.customerName}>{user.name}</span>
                          <span className={styles.customerMeta}>
                            @{user.id?.substring(0, 8)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.contactText}>{user.email || "-"}</span>
                      <span className={styles.contactMeta}>{user.phone || "-"}</span>
                    </td>
                    <td>
                      <select
                        className={styles.roleSelect}
                        value={user.role}
                        disabled={updatingId === user.id || user.id === lastUserIdRef.current}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                      >
                        {config.roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role ? String(role).charAt(0).toUpperCase() + String(role).slice(1) : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          (user.status || "active") === "blocked"
                            ? styles.statusBlocked
                            : styles.statusActive
                        }`}
                      >
                        {config.statusBadges[user.status || "active"] ||
                          (user.status || "active")}
                      </span>
                    </td>
                    <td>
                      <span className={styles.spendText}>
                        {money(user.totalSpent)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.pointsText}>
                        {Number(user.points || 0).toLocaleString("id-ID")}
                      </span>
                    </td>
                    <td>
                      <span className={styles.joinDate}>
                        {formatDate(user.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        {(user.status || "active") === "blocked" ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            disabled={updatingId === user.id || user.id === lastUserIdRef.current}
                            className={styles.activateBtn}
                          >
                            {config.actions.activate}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            disabled={updatingId === user.id || user.id === lastUserIdRef.current}
                            className={styles.blockBtn}
                          >
                            {config.actions.block}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={
                            updatingId === user.id ||
                            deletingId === user.id ||
                            user.id === lastUserIdRef.current
                          }
                          className={styles.deleteBtn}
                          title={config.actions.deleteTitle || config.actions.delete}
                        >
                          <AppIcon name="trash-2" size={13} />
                          <span>{config.actions.delete}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}