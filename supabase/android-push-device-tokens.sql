-- Native Android push registration alongside the existing iOS APNs registry.
-- FCM registration tokens are opaque strings and must not use the APNs hex check.
alter table public.push_device_tokens
  drop constraint if exists push_device_tokens_platform_check,
  drop constraint if exists push_device_tokens_device_token_check;

alter table public.push_device_tokens
  add constraint push_device_tokens_platform_check
    check (platform in ('ios', 'android')),
  add constraint push_device_tokens_device_token_check
    check (
      (platform = 'ios' and device_token ~ '^[0-9a-f]{64,200}$')
      or
      (platform = 'android' and length(device_token) between 32 and 4096)
    );
