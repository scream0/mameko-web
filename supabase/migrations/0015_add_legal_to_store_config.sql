-- Migration: 0015_add_legal_to_store_config.sql
-- Description: Add legal column to store_config for admin-editable Privacy Policy & Terms of Service,
-- and provide security definer RPC for admin user deletion.

-- 1. Ensure legal column exists on store_config
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS legal jsonb DEFAULT '{}'::jsonb;

-- 2. Function for admin to delete a user account safely
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Verify caller is an authenticated admin
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menghapus akun pengguna.';
  END IF;

  -- Prevent admin from deleting themselves
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Admin tidak dapat menghapus akunnya sendiri.';
  END IF;

  -- Anonymize past orders by setting user_id to NULL
  UPDATE public.orders
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- Delete public.profiles and public.users (will cascade if foreign keys exist)
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM public.users WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN true;
END;
$$;
