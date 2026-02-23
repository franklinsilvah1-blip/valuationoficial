-- CRITICAL SECURITY FIX: Remove overly permissive policy from profiles table
-- The "Require authentication for profiles" policy allows ANY authenticated user to view ALL profiles
-- This violates LGPD/GDPR and allows customer data harvesting
-- The correct restrictive policies already exist, we just need to remove the permissive one

DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;