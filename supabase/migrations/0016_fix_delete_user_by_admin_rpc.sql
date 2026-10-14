-- Migration: 0016_fix_delete_user_by_admin_rpc.sql
-- Description: Strengthen delete_user_by_admin RPC to reliably remove from auth.users
-- and grant the necessary privilege so SECURITY DEFINER executes as superuser.

-- Re-create the function with explicit owner = postgres (superuser) so it can
-- access the auth schema. On Supabase the postgres role has the required privilege.
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role text;
  deleted_from_auth boolean := false;
  deleted_from_profiles boolean := false;
  deleted_from_users boolean := false;
BEGIN
  -- 1. Verify caller is an authenticated admin
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menghapus akun pengguna.';
  END IF;

  -- 2. Prevent admin from deleting themselves
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Admin tidak dapat menghapus akunnya sendiri.';
  END IF;

  -- 3. Anonymize past orders (preserve order history, remove personal link)
  UPDATE public.orders
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- 4. Delete from public.profiles
  DELETE FROM public.profiles WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_from_profiles = ROW_COUNT;

  -- 5. Delete from public.users
  DELETE FROM public.users WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_from_users = ROW_COUNT;

  -- 6. Delete from auth.users (requires SECURITY DEFINER running as postgres)
  BEGIN
    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS deleted_from_auth = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    -- auth.users delete failed (privilege issue) — log it but don't fail the whole operation
    RAISE WARNING 'delete_user_by_admin: failed to delete from auth.users for %: %', target_user_id, SQLERRM;
    deleted_from_auth := false;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_from_profiles', (deleted_from_profiles::int > 0),
    'deleted_from_users', (deleted_from_users::int > 0),
    'deleted_from_auth', deleted_from_auth
  );
END;
$$;

-- Ensure the function is owned by postgres (superuser) so auth schema access works
ALTER FUNCTION public.delete_user_by_admin(uuid) OWNER TO postgres;

-- Grant execute to authenticated users (RLS on the function itself checks admin role)
REVOKE ALL ON FUNCTION public.delete_user_by_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;
