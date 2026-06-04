-- ============================================
-- Fix: Profile creation trigger
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. Ensure profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'User',
    role TEXT DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher', 'reviewer')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS but add a permissive insert policy for the trigger
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users see own profile" ON profiles;
CREATE POLICY "Users see own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile  
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow inserts from the trigger (service role bypasses RLS, but just in case)
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
CREATE POLICY "Allow profile creation" ON profiles
    FOR INSERT WITH CHECK (true);

-- 4. Recreate the trigger function with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        'teacher'
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log but don't block user creation
    RAISE LOG 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 5. Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
