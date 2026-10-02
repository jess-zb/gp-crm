-- Run once in Supabase SQL Editor if profile inserts from the app fail with RLS errors.
-- Allows each auth user to create exactly their own profiles row when the signup trigger did not.

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
