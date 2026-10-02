-- ============================================================
-- Email message templates (code defaults + overrides)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,         -- matches /emails/index.ts registry
  name text NOT NULL,                         -- display name
  sequence_key text,                          -- FK-by-text to email_sequences.key
  step_order int,                             -- which step within the sequence
  day_offset int,                             -- denormalized for display
  default_subject text NOT NULL,              -- copied from code default at seed time
  default_body text NOT NULL,                 -- copied from code default at seed time
  subject_override text,                      -- null until edited
  body_override text,                         -- null until edited
  is_overridden boolean NOT NULL DEFAULT false,
  required_variables text[] DEFAULT '{}'::text[],
  category text NOT NULL,                     -- 'lead' | 'cs_active' | 'partial' | 'case_referred' | 'follow_up' | 'holiday'
  is_active boolean NOT NULL DEFAULT true,
  last_edited_by uuid REFERENCES auth.users(id),
  last_edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_message_templates_category_seq_step_idx
  ON email_message_templates (category, sequence_key, step_order);

CREATE INDEX IF NOT EXISTS email_message_templates_is_overridden_idx
  ON email_message_templates (is_overridden)
  WHERE is_overridden = true;

-- === RLS ===
ALTER TABLE email_message_templates ENABLE ROW LEVEL SECURITY;

-- Dev + Admin only (match existing role-check pattern via current_user_role()).
CREATE POLICY "Dev and admin manage email templates"
  ON email_message_templates FOR ALL
  USING (current_user_role() IN ('dev', 'admin'))
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

-- === AUDIT TRAIL (optional but recommended) ===
CREATE TABLE IF NOT EXISTS email_message_template_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES email_message_templates(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  field text NOT NULL,                        -- 'subject' or 'body'
  old_value text,
  new_value text
);

ALTER TABLE email_message_template_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dev and admin view template history"
  ON email_message_template_history FOR SELECT
  USING (current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Dev and admin insert template history"
  ON email_message_template_history FOR INSERT
  WITH CHECK (current_user_role() IN ('dev', 'admin'));

CREATE OR REPLACE FUNCTION log_template_change() RETURNS trigger AS $$
BEGIN
  IF NEW.subject_override IS DISTINCT FROM OLD.subject_override THEN
    INSERT INTO email_message_template_history (template_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, NEW.last_edited_by, 'subject', OLD.subject_override, NEW.subject_override);
  END IF;
  IF NEW.body_override IS DISTINCT FROM OLD.body_override THEN
    INSERT INTO email_message_template_history (template_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, NEW.last_edited_by, 'body', OLD.body_override, NEW.body_override);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_template_change ON email_message_templates;
CREATE TRIGGER trg_log_template_change
  AFTER UPDATE ON email_message_templates
  FOR EACH ROW EXECUTE FUNCTION log_template_change();

-- === SEED ===
-- One row per template_key. Subjects and bodies mirror `emails/*.tsx`.

INSERT INTO email_message_templates (
  template_key,
  name,
  sequence_key,
  step_order,
  day_offset,
  default_subject,
  default_body,
  required_variables,
  category
) VALUES
  (
    'welcome_lead',
    'Welcome – Lead',
    'welcome_lead',
    1,
    0,
    'Welcome to Zero Balance!',
    $$Hi {client.firstName},

Welcome to Zero Balance! Thank you for your authorization, we're excited to have you with us and to help you take this important step toward financial independence.

Our team works with a nationwide network of experienced attorneys who are dedicated to protecting your rights and helping you resolve your enrolled accounts. We are here to make sure you feel supported every step of the way.

You can learn more about us and our process anytime at https://zerobalance.info/

Thank you again for trusting us to help you through this journey. We look forward to working with you and celebrating your progress along the way.

Best regards,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'lead'
  ),
  (
    'follow_up_24hr',
    'Follow Up – 24hr',
    'follow_up_24hr',
    1,
    0,
    'We Missed You – Let''s Reschedule Your Appointment',
    $$Hi {client.firstName},

We tried reaching you for your scheduled follow-up today but weren't able to connect. This call is important — it's where we confirm your account details, review your goals, and officially activate your program.

Please give us a call at (888) 807-4221 or reply to this email to pick a new time that works best for you.

Warm regards,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'follow_up'
  ),
  (
    'welcome_cs',
    'Welcome – Client Services',
    'welcome_cs',
    1,
    0,
    'Welcome to Your Next Step with Zero Balance!',
    $$Hi {client.firstName},

It was great speaking with you today! I want to officially welcome you to the next phase of your program with Zero Balance. My name is Emile Points, and I'm the Manager of the Client Services Department.

From this point forward, Client Services will be your main point of contact throughout the next stage of your program. While you will always have access to your Account Manager, our team will now handle your ongoing communication, progress updates, and any creditor correspondence related to your enrolled accounts.

Over the next 90 days, my team and I will be helping to organize and prepare your case file for review by our nationwide network of attorneys and paralegals. This process ensures that your enrolled accounts are fully documented and positioned for the next step in your program.

You may hear from me directly or another member of my team — but rest assured, we all work closely together and share the same goal. Keeping your case on track to make this process as smooth and successful as possible.

Here's how to reach us anytime:
📞 Client Services Department: 888-807-4221
📞 Direct Line (Emile Points, Manager): 520-689-8843
📧 Email: emile@zerobalance.info

What to expect next:
- Continue to forward any emails, letters, or text messages you receive from your creditors.
- Our team will log and review these communications — they are important in helping the attorneys build your case.
- Once enough documentation has been gathered, your file will be assigned to the attorney team best suited to your specific situation.

We're honored to be part of your journey toward financial freedom, and we'll be in touch often to make sure everything stays on track. If you ever have questions, please don't hesitate to reach out — we're here for you every step of the way.

Warm regards,
Emile Points
Manager, Client Services$$,
    ARRAY['client.firstName']::text[],
    'cs_active'
  ),
  (
    'active_1',
    'Active 1–7 — Day 0',
    'active_arc',
    1,
    0,
    'Welcome—Here''s What Happens Next',
    $$Hi {client.firstName},

Welcome again to Zero Balance—we're excited to support you.

What we've completed:
- Your accounts are officially enrolled.
- Your authorization/retainer was secured on your enrolled card(s).
- We reviewed your goals and we're focused on helping you accomplish all of them.

What to expect next:
- Welcome packet: arriving by mail (up to 10 days).
- Creditor communications: If you receive emails, texts, or letters, forward them to me. For mail, snap a photo and email/text it to me. Our nationwide network of attorneys uses this information to help challenge and invalidate debts.

Your main contacts are me (your Account Manager) and our Client Services team. We'll check in regularly and keep you updated.

We're with you every step of the way.

{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'cs_active'
  ),
  (
    'active_2',
    'Active 1–7 — Day 14',
    'active_arc',
    2,
    14,
    'Quick Check-In—We''re Here for You',
    $$Hi {client.firstName},

Just checking in to say you're on the right track. If you get emails, texts, or letters from creditors, please send them to me right away. This documentation strengthens your case with our nationwide network of attorneys.

Questions? Reply here or call (888) 807-4221.

Warmly,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'cs_active'
  ),
  (
    'active_3',
    'Active 1–7 — Day 21',
    'active_arc',
    3,
    21,
    'Why You MUST Forward Creditor Mail',
    $$Hi {client.firstName},

A quick reminder: forward any creditor emails, texts, snap a photo of any mail and send it over to support@zerobalance.info. Our nationwide network of attorneys relies on this information to challenge and invalidate the enrolled debts.

Thanks for staying on top of it—this is a big help.

Best,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'cs_active'
  ),
  (
    'active_4',
    'Active 1–7 — Day 30',
    'active_arc',
    4,
    30,
    'One Month In—You''re Doing Great!',
    $$Hi {client.firstName},

You're about a month in—great job staying consistent.

Remember:
- Ignore phone calls from creditors (don't engage).
- Forward any emails, texts, or letters to me.
- Your Welcome packet may take up to 10 days (if you haven't received it, call (888) 807-4221).

Need anything right now? Hit reply—we're here.

Onward,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'cs_active'
  ),
  (
    'active_5',
    'Active 1–7 — Day 45',
    'active_arc',
    5,
    45,
    'How to Stay Confident During Your Program',
    $$Hi {client.firstName},

Staying confident helps the process. Quick tips:
- If creditors call, don't engage—ignore the call.
- Forward any emails, texts, or letters to us immediately.
- Keep our number handy: (888) 807-4221.

You're doing great—every week is progress.

With you,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'cs_active'
  ),
  (
    'active_6',
    'Active 1–7 — Day 60',
    'active_arc',
    6,
    60,
    'Halfway Through—Keeping You on Track',
    $$Hi {client.firstName},

You're making solid progress. Thank you for forwarding communications and sticking to the plan. If anything feels unclear—or if your situation changes—reply here or contact us at (888) 807-4221 and we'll adjust together.

Proud to be on your team,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'cs_active'
  ),
  (
    'active_7',
    'Active 1–7 — Day 90',
    'active_arc',
    7,
    90,
    '90 Days Strong—Thank You for Trusting Zero Balance',
    $$Hi {client.firstName},

You've been steady for 90 days—great work. Keep forwarding any emails, texts, or letters you receive. Your consistency helps our nationwide network of attorneys continue challenging the enrolled debts.

As always, we're always here for you—reply anytime.

Thank you for trusting us,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'cs_active'
  ),
  (
    'partial_1',
    'Partial 1–4 — Day 0',
    'partial_arc',
    1,
    0,
    'Let''s Complete Your Enrollment Today',
    $$Hi {client.firstName},

We noticed we missed you for the final step of enrollment. To activate your program and protect your enrolled accounts, we just need to complete your retainer.

Please call us today at (888) 807-4221 and we'll wrap this up in a couple of minutes.

If it's easier, reply to this email with a good time to call you.

Best,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'partial'
  ),
  (
    'partial_2',
    'Partial 1–4 — Day 3',
    'partial_arc',
    2,
    3,
    'Your Enrollment Is Still Pending',
    $$Hi {client.firstName},

Your program isn't active yet. Once we finalize your retainer on the enrolled card, your file moves forward and your accounts are protected.

Call us at (888) 807-4221 or reply with a good time—we'll make this quick and easy.

You're almost there.

Best regards,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'partial'
  ),
  (
    'partial_3',
    'Partial 1–4 — Day 7',
    'partial_arc',
    3,
    7,
    'Urgent: Last Step to Activate Your Program',
    $$Hi {client.firstName},

We're still holding your file so you don't lose your place in line. To activate your program, we need to complete the retainer payment you authorized.

Please call (888) 807-4221 or reply to this email and we'll take care of it.

Thanks,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'partial'
  ),
  (
    'partial_4',
    'Partial 1–4 — Day 10',
    'partial_arc',
    4,
    10,
    'Last Chance to Confirm Your Enrollment',
    $$Hi {client.firstName},

This is our final attempt to help you finish enrollment. Without completing the retainer on your enrolled card, we cannot activate your program or move your file forward.

If you'd like to proceed, call (888) 807-4221 or reply within the next 24 hours.

If you no longer wish to continue, let us know and we'll close your file.

Sincerely,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'partial'
  ),
  (
    'case_referred',
    'Case Referred to Attorneys',
    'case_referred',
    1,
    0,
    'Congrats! Your File Is Now with Our Attorney Network',
    $$Hi {client.firstName},

Congratulations—your program is fully active and your file has been referred to our nationwide network of attorneys for ongoing work on your behalf.

At Zero Balance, your Account Manager remains the same and our Client Services department too. If you receive emails, texts, or letters from any creditors, continue to forward them to us right away.

We're here for you—reply to this email or call (888) 807-4221 with any questions.

Warm regards,
{accountManager.firstName} {accountManager.lastName}$$,
    ARRAY['client.firstName','accountManager.firstName','accountManager.lastName','unsubscribeUrl']::text[],
    'case_referred'
  ),
  (
    'holiday',
    'Holiday Auto-Responder',
    'holiday',
    1,
    0,
    'We''re currently closed for the holidays',
    $$Dear {client.firstName},

Please be advised that our offices are currently closed in observance of the holiday season. We will resume standard business operations on the following business day, at which time we will attend to all inquiries with priority.

We appreciate your patience and apologize for any inconvenience this temporary closure may cause. Should you have any matters requiring immediate attention, we invite you to contact us in advance so that we may provide the necessary assistance.

Thank you for your continued partnership and support.

Sincerely,
The Zero Balance Team$$,
    ARRAY['client.firstName']::text[],
    'holiday'
  )
ON CONFLICT (template_key) DO NOTHING;

