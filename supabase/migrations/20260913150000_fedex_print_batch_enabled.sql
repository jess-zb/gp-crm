-- Dev toggle: pause Sunday/Wednesday PostLogic printer cron (and manual send).
-- false = paused until documentation is ready. Flip via Packet Manager (role = dev).
INSERT INTO crm_settings (key, value)
VALUES ('fedex_print_batch_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
