-- 1. Create delete_company_member SECURITY DEFINER function to allow admins to delete members completely from auth.users
CREATE OR REPLACE FUNCTION public.delete_company_member(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  target_company_id UUID;
  caller_name TEXT;
  target_email TEXT;
BEGIN
  -- Find the company of the target user
  SELECT company_id INTO target_company_id
  FROM public.company_members
  WHERE user_id = target_user_id
  LIMIT 1;

  IF target_company_id IS NULL THEN
    -- If they don't belong to a company, let's check if the caller is a platform admin
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = caller_id AND role = 'admin') THEN
      RAISE EXCEPTION 'User does not belong to any company, and you are not a platform admin.';
    END IF;
  ELSE
    -- Check if caller is company admin for that company, or a platform admin
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = target_company_id AND user_id = caller_id AND role = 'admin'
    ) AND NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = caller_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access denied. You must be the company admin or a platform admin to delete this member.';
    END IF;
  END IF;

  -- Prevent deleting oneself
  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'You cannot delete yourself.';
  END IF;

  -- Prevent deleting the company owner
  IF EXISTS (SELECT 1 FROM public.companies WHERE owner_user_id = target_user_id) THEN
    RAISE EXCEPTION 'Cannot delete the owner of a company. Transfer company ownership first.';
  END IF;

  -- Fetch details for audit log
  SELECT COALESCE(full_name, email, 'Admin') INTO caller_name
  FROM public.profiles
  WHERE id = caller_id;

  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id;

  -- Log audit event before deletion (only if there is a company)
  IF target_company_id IS NOT NULL THEN
    INSERT INTO public.employer_audit_logs (company_id, user_id, action_type, description)
    VALUES (
      target_company_id,
      caller_id,
      'delete_member',
      'Team member ' || COALESCE(target_email, target_user_id::text) || ' was removed from the company and system by ' || caller_name
    );
  END IF;

  -- Delete from company_members, profiles, auth.users
  DELETE FROM public.company_members WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- 2. Explicit policies for public.employer_audit_logs
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.employer_audit_logs;
CREATE POLICY "Admins can manage audit logs" ON public.employer_audit_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Company members can view own audit logs" ON public.employer_audit_logs;
CREATE POLICY "Company members can view own audit logs" ON public.employer_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = employer_audit_logs.company_id
      AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can insert own audit logs" ON public.employer_audit_logs;
CREATE POLICY "Company members can insert own audit logs" ON public.employer_audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = employer_audit_logs.company_id
      AND company_members.user_id = auth.uid()
    )
  );
