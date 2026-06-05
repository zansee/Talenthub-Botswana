-- Enable pg_net extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function to trigger HTTP call to the Edge Function send-push-notification
CREATE OR REPLACE FUNCTION public.send_push_notification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trigger asynchronous HTTP call to Edge Function
  PERFORM net.http_post(
    url := 'https://hovxyfqpinwqomvevrfb.supabase.co/functions/v1/send-push-notification'::text,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

-- Setup the trigger on insert on public.notifications
DROP TRIGGER IF EXISTS trg_send_push_notification ON public.notifications;
CREATE TRIGGER trg_send_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.send_push_notification_on_insert();
