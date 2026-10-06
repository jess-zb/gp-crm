-- Reference data every Golden Pathway database needs.
--
-- Idempotent: safe to re-run. `supabase db reset` and `supabase start` apply it
-- automatically after the migrations.
--
-- Staff accounts are NOT seeded. Create the first dev user through Supabase
-- Auth, promote it to role 'dev', then invite the rest from /team.


-- teams (4 rows)
INSERT INTO public.teams (id, name, description, created_at) VALUES ('bdc42747-093e-4b28-b124-2c12bac6b4e4', 'Account Managers', NULL, '2026-10-02 21:33:14.410735+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.teams (id, name, description, created_at) VALUES ('03523bdf-cea3-4207-9d89-4fc083040436', 'Client Services', NULL, '2026-10-02 21:33:14.410735+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.teams (id, name, description, created_at) VALUES ('87749466-c135-4a78-981b-864b11bfb33c', 'Legal / Attorneys', NULL, '2026-10-02 21:33:14.410735+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.teams (id, name, description, created_at) VALUES ('ca600c35-b86e-4beb-84d9-9ae52895f71f', 'Leadership', NULL, '2026-10-02 21:33:14.410735+00')
ON CONFLICT DO NOTHING;

-- crm_settings (1 rows)
INSERT INTO public.crm_settings (key, value, updated_by, updated_at) VALUES ('email_sequences_enabled', 'false', NULL, '2026-10-02 21:33:26.896617+00')
ON CONFLICT DO NOTHING;

-- chat_channels (4 rows)
INSERT INTO public.chat_channels (id, name, type, department, created_at, participant_1, participant_2) VALUES ('7b425100-51ac-4bd3-a61b-bb54e247b9cc', 'Announcements', 'announcement', NULL, '2026-10-02 21:33:26.731257+00', NULL, NULL)
ON CONFLICT DO NOTHING;
INSERT INTO public.chat_channels (id, name, type, department, created_at, participant_1, participant_2) VALUES ('8c1992c5-80da-4eef-848c-2f5d78c49b49', 'Account Managers', 'department', 'accounts', '2026-10-02 21:33:26.731631+00', NULL, NULL)
ON CONFLICT DO NOTHING;
INSERT INTO public.chat_channels (id, name, type, department, created_at, participant_1, participant_2) VALUES ('42840255-d623-435c-9e37-54e5dee81fab', 'Services', 'department', 'services', '2026-10-02 21:33:26.731949+00', NULL, NULL)
ON CONFLICT DO NOTHING;
INSERT INTO public.chat_channels (id, name, type, department, created_at, participant_1, participant_2) VALUES ('6eed2fe4-f7e9-4548-a79e-2a803fe1d4ce', 'General', 'department', NULL, '2026-10-02 21:33:26.73226+00', NULL, NULL)
ON CONFLICT DO NOTHING;

-- email_sequences (7 rows)
INSERT INTO public.email_sequences (id, key, name, trigger_status, trigger_type, cancels_keys, is_active, created_at) VALUES ('1e077c18-79a5-40d6-9dff-1d4639da708d', 'welcome_lead', 'Welcome – Lead', 'lead', 'status', '{}', true, '2026-10-02 21:33:26.099956+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequences (id, key, name, trigger_status, trigger_type, cancels_keys, is_active, created_at) VALUES ('d1daf6d0-eae7-4078-ad52-af253b1f6391', 'welcome_cs', 'Welcome – Client Services', 'active', 'status', '{welcome_lead,follow_up_24hr}', true, '2026-10-02 21:33:26.099956+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequences (id, key, name, trigger_status, trigger_type, cancels_keys, is_active, created_at) VALUES ('4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 'active_arc', 'Active 1–7', 'active', 'status', '{partial_arc,welcome_lead,follow_up_24hr}', true, '2026-10-02 21:33:26.099956+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequences (id, key, name, trigger_status, trigger_type, cancels_keys, is_active, created_at) VALUES ('7de55abc-4d17-46d2-aa37-a708dc4de3ed', 'partial_arc', 'Partial 1–4', NULL, 'duration', '{welcome_lead,follow_up_24hr}', true, '2026-10-02 21:33:26.099956+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequences (id, key, name, trigger_status, trigger_type, cancels_keys, is_active, created_at) VALUES ('800ee062-cb84-4bd6-be69-8e76f534e73f', 'case_referred', 'Case Referred to Attorneys', 'case_referred', 'status', '{active_arc,partial_arc}', true, '2026-10-02 21:33:26.099956+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequences (id, key, name, trigger_status, trigger_type, cancels_keys, is_active, created_at) VALUES ('e5173394-af9a-440b-93cf-9078d8aff646', 'holiday', 'Holiday Auto-Responder', NULL, 'date', '{}', true, '2026-10-02 21:33:26.099956+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequences (id, key, name, trigger_status, trigger_type, cancels_keys, is_active, created_at) VALUES ('dd61524d-2f15-42c2-9329-28a87df7ef02', 'follow_up_24hr', 'Follow Up – 24hr', NULL, 'reminder', '{}', false, '2026-10-02 21:33:26.099956+00')
ON CONFLICT DO NOTHING;

-- email_sequence_steps (16 rows)
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('4884b5ff-f133-4f09-a5ac-aa0655860b67', '1e077c18-79a5-40d6-9dff-1d4639da708d', 1, 0, 'welcome_lead', 'Welcome to Golden Pathway!')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('10c68fb8-6b03-49f5-ba16-3251fc5092b7', 'd1daf6d0-eae7-4078-ad52-af253b1f6391', 1, 0, 'welcome_cs', 'Welcome to Your Next Step with Golden Pathway!')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('711d24c9-6b4a-43bc-a9ed-8b79fe6ba79b', '4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 7, 90, 'active_7', '90 Days Strong—Thank You for Trusting Golden Pathway')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('fd966369-ebe9-4c67-bf2b-cedb83d30c03', '4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 6, 60, 'active_6', 'Halfway Through—Keeping You on Track')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('7d2002e6-7f98-4ab8-97a5-111d47c8a579', '4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 5, 45, 'active_5', 'How to Stay Confident During Your Program')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('346a7365-62a7-422e-87d2-e7b4aec73b26', '4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 4, 30, 'active_4', 'One Month In—You''re Doing Great!')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('5e7f38c4-46c1-4566-b4ff-98e3e0200b00', '4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 3, 21, 'active_3', 'Why You MUST Forward Creditor Mail')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('f78723e7-ba18-4190-b3f2-7841d5d27f17', '4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 2, 14, 'active_2', 'Quick Check-In—We''re Here for You')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('12c2dc1e-07ea-410a-b257-bfdd6b1b47c0', '4e1fd47e-9d0c-49e9-a584-22d8b1884c23', 1, 0, 'active_1', 'Welcome—Here''s What Happens Next')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('87131caa-3868-43f8-bea0-7fb23b5638d3', '7de55abc-4d17-46d2-aa37-a708dc4de3ed', 4, 10, 'partial_4', 'Last Chance to Confirm Your Enrollment')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('f87936db-b09c-4401-927d-dbe485605cc3', '7de55abc-4d17-46d2-aa37-a708dc4de3ed', 3, 7, 'partial_3', 'Urgent: Last Step to Activate Your Program')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('06c99d7d-6506-4164-8d6f-17d4361fbb62', '7de55abc-4d17-46d2-aa37-a708dc4de3ed', 2, 3, 'partial_2', 'Your Enrollment Is Still Pending')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('9df59290-5449-4fac-ba41-c8137c401538', '7de55abc-4d17-46d2-aa37-a708dc4de3ed', 1, 0, 'partial_1', 'Let''s Complete Your Enrollment Today')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('3eb5a904-c451-40a8-baf8-0ecc67c07bb5', '800ee062-cb84-4bd6-be69-8e76f534e73f', 1, 0, 'case_referred', 'Congrats! Your File Is Now with Our Attorney Network')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('ddb52528-0c64-452f-bec3-d0737af82ef6', 'dd61524d-2f15-42c2-9329-28a87df7ef02', 1, 0, 'follow_up_24hr', 'We Missed You – Let''s Reschedule Your Appointment')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_sequence_steps (id, sequence_id, step_order, day_offset, template_key, subject) VALUES ('9dff19b9-54c5-43f4-bfe2-266e0acf4ce8', 'e5173394-af9a-440b-93cf-9078d8aff646', 1, 0, 'holiday', 'We''re currently closed for the holidays')
ON CONFLICT DO NOTHING;

-- email_message_templates (17 rows)
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('81fbab8c-e31d-407e-aff0-8b342b90659a', 'welcome_lead', 'Welcome – Lead', 'welcome_lead', 1, 0, 'Welcome to Golden Pathway!', 'Hi {client.firstName},

Welcome to Golden Pathway! Thank you for your authorization, we''re excited to have you with us and to help you take this important step toward financial independence.

Our team works with a nationwide network of experienced attorneys who are dedicated to protecting your rights and helping you resolve your enrolled accounts. We are here to make sure you feel supported every step of the way.

You can learn more about us and our process anytime at https://www.goldenpathway.io

Thank you again for trusting us to help you through this journey. We look forward to working with you and celebrating your progress along the way.

Best regards,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'lead', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('245db458-5a36-44c2-b4dc-9c095b78d53e', 'follow_up_24hr', 'Follow Up – 24hr', 'follow_up_24hr', 1, 0, 'We Missed You – Let''s Reschedule Your Appointment', 'Hi {client.firstName},

We tried reaching you for your scheduled follow-up today but weren''t able to connect. This call is important — it''s where we confirm your account details, review your goals, and officially activate your program.

Please give us a call at 928-433-8408 or reply to this email to pick a new time that works best for you.

Warm regards,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'follow_up', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('db7c9595-c1a2-4b22-98b0-cdf1ff796643', 'welcome_cs', 'Welcome – Client Services', 'welcome_cs', 1, 0, 'Welcome to Your Next Step with Golden Pathway!', 'Hi {client.firstName},

It was great speaking with you today! I want to officially welcome you to the next phase of your program with Golden Pathway. The Client Services team will take it from here.

From this point forward, Client Services will be your main point of contact throughout the next stage of your program. While you will always have access to your Account Manager, our team will now handle your ongoing communication, progress updates, and any creditor correspondence related to your enrolled accounts.

Over the next 90 days, my team and I will be helping to organize and prepare your case file for review by our nationwide network of attorneys and paralegals. This process ensures that your enrolled accounts are fully documented and positioned for the next step in your program.

You may hear from me directly or another member of my team — but rest assured, we all work closely together and share the same goal. Keeping your case on track to make this process as smooth and successful as possible.

Here''s how to reach us anytime:
📞 928-433-8408
📧 support@goldenpathway.io

What to expect next:
- Continue to forward any emails, letters, or text messages you receive from your creditors.
- Our team will log and review these communications — they are important in helping the attorneys build your case.
- Once enough documentation has been gathered, your file will be assigned to the attorney team best suited to your specific situation.

We''re honored to be part of your journey toward financial freedom, and we''ll be in touch often to make sure everything stays on track. If you ever have questions, please don''t hesitate to reach out — we''re here for you every step of the way.

Warm regards,
The Golden Pathway Client Services Team', NULL, NULL, false, '{client.firstName}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('a235fb7a-54ba-4e8c-8d48-1c42782ab283', 'active_1', 'Active 1–7 — Day 0', 'active_arc', 1, 0, 'Welcome—Here''s What Happens Next', 'Hi {client.firstName},

Welcome again to Golden Pathway—we''re excited to support you.

What we''ve completed:
- Your accounts are officially enrolled.
- Your authorization/retainer was secured on your enrolled card(s).
- We reviewed your goals and we''re focused on helping you accomplish all of them.

What to expect next:
- Welcome packet: we email you a link to review and sign it.
- Creditor communications: If you receive emails, texts, or letters, forward them to me. For mail, snap a photo and email/text it to me. Our nationwide network of attorneys uses this information to help challenge and invalidate debts.

Your main contacts are me (your Account Manager) and our Client Services team. We''ll check in regularly and keep you updated.

We''re with you every step of the way.

{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('aac5db7e-90f7-4715-b20c-c75ea8322839', 'active_2', 'Active 1–7 — Day 14', 'active_arc', 2, 14, 'Quick Check-In—We''re Here for You', 'Hi {client.firstName},

Just checking in to say you''re on the right track. If you get emails, texts, or letters from creditors, please send them to me right away. This documentation strengthens your case with our nationwide network of attorneys.

Questions? Reply here or call 928-433-8408.

Warmly,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('f99d254e-7537-4eda-841d-7bc8646b1b2b', 'active_3', 'Active 1–7 — Day 21', 'active_arc', 3, 21, 'Why You MUST Forward Creditor Mail', 'Hi {client.firstName},

A quick reminder: forward any creditor emails, texts, snap a photo of any mail and send it over to support@goldenpathway.io. Our nationwide network of attorneys relies on this information to challenge and invalidate the enrolled debts.

Thanks for staying on top of it—this is a big help.

Best,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('53fccef2-3ef6-4f75-af6e-e23b46264a82', 'active_4', 'Active 1–7 — Day 30', 'active_arc', 4, 30, 'One Month In—You''re Doing Great!', 'Hi {client.firstName},

You''re about a month in—great job staying consistent.

Remember:
- Ignore phone calls from creditors (don''t engage).
- Forward any emails, texts, or letters to me.
- If you still need to sign your Welcome Packet, use the link we emailed you (or call 928-433-8408).

Need anything right now? Hit reply—we''re here.

Onward,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('b4d35fd3-98f0-422e-b8da-f5a1048197ff', 'active_5', 'Active 1–7 — Day 45', 'active_arc', 5, 45, 'How to Stay Confident During Your Program', 'Hi {client.firstName},

Staying confident helps the process. Quick tips:
- If creditors call, don''t engage—ignore the call.
- Forward any emails, texts, or letters to us immediately.
- Keep our number handy: 928-433-8408.

You''re doing great—every week is progress.

With you,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('f6deb16d-0a1f-468f-b597-52ee8978afbf', 'active_6', 'Active 1–7 — Day 60', 'active_arc', 6, 60, 'Halfway Through—Keeping You on Track', 'Hi {client.firstName},

You''re making solid progress. Thank you for forwarding communications and sticking to the plan. If anything feels unclear—or if your situation changes—reply here or contact us at 928-433-8408 and we''ll adjust together.

Proud to be on your team,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('7fefa520-27b4-4e24-aa69-90c10714973c', 'active_7', 'Active 1–7 — Day 90', 'active_arc', 7, 90, '90 Days Strong—Thank You for Trusting Golden Pathway', 'Hi {client.firstName},

You''ve been steady for 90 days—great work. Keep forwarding any emails, texts, or letters you receive. Your consistency helps our nationwide network of attorneys continue challenging the enrolled debts.

As always, we''re always here for you—reply anytime.

Thank you for trusting us,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'cs_active', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('94544076-39f9-4fa5-83d0-30c713c291f8', 'partial_1', 'Partial 1–4 — Day 0', 'partial_arc', 1, 0, 'Let''s Complete Your Enrollment Today', 'Hi {client.firstName},

We noticed we missed you for the final step of enrollment. To activate your program and protect your enrolled accounts, we just need to complete your retainer.

Please call us today at 928-433-8408 and we''ll wrap this up in a couple of minutes.

If it''s easier, reply to this email with a good time to call you.

Best,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'partial', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('be754fc5-92b9-47f5-9a9e-74971cae1de0', 'partial_2', 'Partial 1–4 — Day 3', 'partial_arc', 2, 3, 'Your Enrollment Is Still Pending', 'Hi {client.firstName},

Your program isn''t active yet. Once we finalize your retainer on the enrolled card, your file moves forward and your accounts are protected.

Call us at 928-433-8408 or reply with a good time—we''ll make this quick and easy.

You''re almost there.

Best regards,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'partial', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('2262b7f5-e716-45cf-bb77-8107cdd62427', 'partial_3', 'Partial 1–4 — Day 7', 'partial_arc', 3, 7, 'Urgent: Last Step to Activate Your Program', 'Hi {client.firstName},

We''re still holding your file so you don''t lose your place in line. To activate your program, we need to complete the retainer payment you authorized.

Please call 928-433-8408 or reply to this email and we''ll take care of it.

Thanks,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'partial', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('e516ec46-7474-41d4-8013-af9f145bf7b1', 'partial_4', 'Partial 1–4 — Day 10', 'partial_arc', 4, 10, 'Last Chance to Confirm Your Enrollment', 'Hi {client.firstName},

This is our final attempt to help you finish enrollment. Without completing the retainer on your enrolled card, we cannot activate your program or move your file forward.

If you''d like to proceed, call 928-433-8408 or reply within the next 24 hours.

If you no longer wish to continue, let us know and we''ll close your file.

Sincerely,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'partial', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('f5aa97db-9631-43bf-97bf-79d16346148b', 'case_referred', 'Case Referred to Attorneys', 'case_referred', 1, 0, 'Congrats! Your File Is Now with Our Attorney Network', 'Hi {client.firstName},

Congratulations—your program is fully active and your file has been referred to our nationwide network of attorneys for ongoing work on your behalf.

At Golden Pathway, your Account Manager remains the same and our Client Services department too. If you receive emails, texts, or letters from any creditors, continue to forward them to us right away.

We''re here for you—reply to this email or call 928-433-8408 with any questions.

Warm regards,
{accountManager.firstName} {accountManager.lastName}', NULL, NULL, false, '{client.firstName,accountManager.firstName,accountManager.lastName,unsubscribeUrl}', 'case_referred', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('0ab8ad40-7e81-44dd-a818-ec7c4d45adff', 'holiday', 'Holiday Auto-Responder', 'holiday', 1, 0, 'We''re currently closed for the holidays', 'Dear {client.firstName},

Please be advised that our offices are currently closed in observance of the holiday season. We will resume standard business operations on the following business day, at which time we will attend to all inquiries with priority.

We appreciate your patience and apologize for any inconvenience this temporary closure may cause. Should you have any matters requiring immediate attention, we invite you to contact us in advance so that we may provide the necessary assistance.

Thank you for your continued partnership and support.

Sincerely,
The Golden Pathway Team', NULL, NULL, false, '{client.firstName}', 'holiday', true, NULL, NULL, '2026-10-02 21:33:26.131365+00')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_message_templates (id, template_key, name, sequence_key, step_order, day_offset, default_subject, default_body, subject_override, body_override, is_overridden, required_variables, category, is_active, last_edited_by, last_edited_at, created_at) VALUES ('685ab7d9-f8d5-4aa1-a6ef-1f1a80fdf52a', 'attorney_portal_assignment', 'Attorney Portal — New Case Assigned', NULL, NULL, NULL, 'New Case Assigned — Golden Pathway Attorney Portal', 'Hi {attorney.firstName},

A new case has been assigned to you in the Golden Pathway attorney portal.

Sign in with your attorney CRM credentials to review client contact info, the signed Welcome Packet, and collection letters.', NULL, NULL, false, '{attorney.firstName,casesUrl,clients}', 'staff', true, NULL, NULL, '2026-10-02 21:33:27.311617+00')
ON CONFLICT DO NOTHING;

-- reminder_templates (17 rows)
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('fc6e0bdc-b8ab-434b-be8c-49795024274f', 'account_manager', 'Follow up with a client still in Account Manager (enrollment), not packet delivery', 168, false, '2026-10-02 21:41:34.40847+00', 'AM Enrollment Follow-Up')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('2c4bf75d-07b0-4886-872f-abc6ead655a8', 'lead', 'Initial lead follow up call', 0, false, '2026-10-02 21:41:34.40847+00', 'Lead Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('242d91c9-5abc-41b2-9b39-5108b9f22514', 'lead', '24 hour follow up call', 24, false, '2026-10-02 21:41:34.40847+00', '24hr Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('717cdcf4-7e71-40fb-81f5-5c2042f4e757', 'lead', '48 hour follow up call', 48, false, '2026-10-02 21:41:34.40847+00', '48hr Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('a5cf2000-63a3-46b5-bb03-19e149e9f5d4', 'client_services', 'Welcome call to client', 2, false, '2026-10-02 21:41:34.40847+00', 'Welcome Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('56359d61-016f-45e4-ba8b-3740a5de5b64', 'client_services', '24 hour follow up', 24, false, '2026-10-02 21:41:34.40847+00', '24hr Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('6c67c0fb-0448-4bf0-a45b-a0c3f7a3291b', 'retention', 'Retention follow up call', 2, false, '2026-10-02 21:41:34.40847+00', 'Retention Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('e241f38d-7ca8-44e6-8f8c-3d1a891c5c3b', 'retention', '24 hour retention follow up', 24, false, '2026-10-02 21:41:34.40847+00', '24hr Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('bd059b4b-1f73-41a1-99d4-470a22370b36', 'retention', '48 hour retention follow up', 48, false, '2026-10-02 21:41:34.40847+00', '48hr Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('dec6fcd8-1c70-4f33-8864-d54805e0689e', 'account_manager', 'Confirm welcome packet sent', 2, false, '2026-10-02 21:41:34.40847+00', 'Packet Sent')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('d819d2ea-cafd-4005-a457-eae0a286a282', 'awaiting_collection_letter', 'Check on collection letters', 48, false, '2026-10-02 21:41:34.40847+00', 'Waiting Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('a748b86b-569b-496c-8508-eec187d4b6df', 'awaiting_collection_letter', 'Week follow up on letters', 168, false, '2026-10-02 21:41:34.40847+00', '7 Day Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('5782b02b-5c12-4f3c-9877-03cf6a0341de', 'awaiting_collection_letter', '30 day follow up', 720, false, '2026-10-02 21:41:34.40847+00', '30 Day Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('83012452-a05b-4768-97cf-1cc2cb490282', 'case_sent_to_attorneys', 'Notify client case sent', 4, false, '2026-10-02 21:41:34.40847+00', 'Case Sent Call')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('a42003f3-d356-44a6-9cc4-b48a92e7a1c6', 'case_sent_to_attorneys', '30 day attorney check in', 720, false, '2026-10-02 21:41:34.40847+00', '30 Day Check')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('9f5f7371-9a87-420b-be16-fb49fb377cae', 'dnc', 'Confirm DNC status with client', 24, false, '2026-10-02 21:41:34.40847+00', 'DNC Confirmed')
ON CONFLICT DO NOTHING;
INSERT INTO public.reminder_templates (id, stage, description, hours_after_stage_entry, is_active, created_at, title) VALUES ('4e4bc8de-91a8-4f8c-b4c4-d586d524e37c', 'closed', 'Final closed case call', 4, false, '2026-10-02 21:41:34.40847+00', 'Closed Call')
ON CONFLICT DO NOTHING;
