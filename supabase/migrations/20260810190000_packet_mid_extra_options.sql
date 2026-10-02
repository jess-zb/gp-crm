-- Extra Packet Needed MID picker options (JSON string array), editable by
-- the dev role via Packet Manager UI. Built-in MERCHANT_OPTIONS stay in code.
INSERT INTO crm_settings (key, value)
VALUES ('packet_mid_extra_options', '[]')
ON CONFLICT (key) DO NOTHING;
