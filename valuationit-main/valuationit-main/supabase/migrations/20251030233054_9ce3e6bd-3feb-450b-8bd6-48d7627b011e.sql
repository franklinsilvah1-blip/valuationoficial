-- Add explicit authentication requirements to protect against anonymous access

-- Require authentication for profiles table
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Require authentication for profile_answers table
CREATE POLICY "Require authentication for profile_answers"
ON public.profile_answers
FOR ALL
USING (auth.uid() IS NOT NULL);