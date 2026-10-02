/** Help content for the `acct_manager` role (labeled “User” in the CRM UI). */
export const ACCT_MANAGER_HELP_CATEGORIES = [
  {
    id: "daily-workflow",
    title: "Daily Workflow",
    articles: [
      {
        id: "daily-checklist",
        title: "Your daily checklist (User role)",
        body:
          "dashboard collection letters attorneys appointments pipeline communications portal messages stuck stage",
        blocks: [
          {
            type: "p",
            text: "Start each day by checking your Dashboard for:",
          },
          {
            type: "ol",
            items: [
              "Clients Awaiting Collection Letters — these need immediate follow up",
              "Cases at Attorneys — confirm attorneys have what they need",
              "Check Appointments for any tasks due today",
              "Review the Pipeline for clients stuck in the same stage 15+ days",
              "Check Communications for any unread client portal messages",
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Handle Overdue on the Appointments page before diving into new work — it keeps your dashboard counts accurate.",
          },
        ],
      },
      {
        id: "prioritize-clients",
        title: "How to prioritize your clients",
        body:
          "pipeline red yellow green cards stage days attention follow up monitor",
        blocks: [
          {
            type: "p",
            text: "Use the Pipeline view to see all clients by stage.",
          },
          {
            type: "ul",
            items: [
              "Cards highlighted in RED have been in the same stage for 15+ days — these need immediate attention.",
              "Cards in YELLOW are 8–14 days — follow up soon.",
              "Cards in GREEN are on track — just monitor.",
            ],
          },
          {
            type: "callout",
            variant: "note",
            text: "Sort mentally by RED first, then YELLOW, then messages waiting in Communications or Portal Messages.",
          },
        ],
      },
      {
        id: "pipeline-view-howto",
        title: "How to use the Pipeline view",
        body:
          "pipeline sidebar sales service lead compliance welcome packet collection letter attorneys closed click card profile",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Pipeline in the sidebar.",
              "Sales Pipeline shows: New Lead, Account Manager, Retention.",
              "Service Pipeline shows: Welcome Packet, Awaiting Collection Letter, Case Sent to Attorneys, Closed.",
              "Click any client card to open their profile.",
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Switch between Sales and Service tabs at the top of the board to match how your client is progressing.",
          },
        ],
      },
    ],
  },
  {
    id: "managing-clients",
    title: "Managing Clients",
    articles: [
      {
        id: "find-client",
        title: "How to find a client",
        body:
          "clients sidebar search name email phone active inactive archived row profile",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Clients in the sidebar.",
              "Use the search bar to search by name, email, or phone number.",
              "Filter by All, Active, Inactive, or Archived using the tabs.",
              "Click anywhere on the client row to open their profile.",
            ],
          },
        ],
      },
      {
        id: "add-new-client",
        title: "How to add a new client",
        body:
          "add new client dashboard required fields phone address assigned user delivery fedex lead submit address autocomplete",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Add New Client on the Clients page or Dashboard.",
              "Required fields: First Name, Last Name, Email, at least one phone number, Street Address, Assigned User, and Delivery Method.",
              "Start typing the address — suggestions will appear automatically.",
              "Select FedEx for the welcome packet delivery.",
              "Click Submit. The client is created as a New Lead automatically.",
            ],
          },
          {
            type: "callout",
            variant: "warning",
            text: "Do not skip Assigned User — someone must own the relationship for appointments and handoffs.",
          },
        ],
      },
      {
        id: "advance-stage",
        title: "How to advance a client to the next stage",
        body:
          "profile header advance go back next stage green button activity log",
        blocks: [
          {
            type: "p",
            text: "Open the client profile. At the top of the page you will see:",
          },
          {
            type: "p",
            text: "← Go Back · [Current Stage] · Advance to: [Next Stage] →",
          },
          {
            type: "ol",
            items: [
              "Click the green Advance button to move them forward.",
              "Click Go Back to revert if a mistake was made.",
              "Every stage change is recorded in the Activity Log.",
            ],
          },
        ],
      },
      {
        id: "revert-stage",
        title: "How to revert a client stage",
        body:
          "go back gray button one stage communications note explain mistake",
        blocks: [
          {
            type: "ol",
            items: [
              "On the client profile header, click the gray ← Go Back button.",
              "This moves the client back one stage.",
              "A reason is not required but add a note in the Activity tab explaining why you reverted.",
            ],
          },
          {
            type: "callout",
            variant: "note",
            text: "If attorneys or fulfillment were already notified, follow up with a quick internal note so the team stays aligned.",
          },
        ],
      },
      {
        id: "add-reminder-client",
        title: "How to add an appointment for a client",
        body:
          "sidebar appointments add plus description due date save appointments page",
        blocks: [
          {
            type: "ol",
            items: [
              "On the client profile, click Add+ next to Appointments in the right sidebar.",
              "Enter a description of what needs to be done.",
              "Set a due date and time.",
              "Click Save. The appointment appears on your Appointments page.",
            ],
          },
        ],
      },
      {
        id: "complete-reminder",
        title: "How to mark an appointment complete",
        body:
          "sidebar checkmark appointments page green complete",
        blocks: [
          {
            type: "ol",
            items: [
              "On the client profile sidebar, find the appointment.",
              "Click the green checkmark button next to it.",
              "Or go to the Appointments page and click the checkmark there.",
            ],
          },
        ],
      },
      {
        id: "add-note-client",
        title: "How to add a note to a client",
        body:
          "activity tab add note save feed",
        blocks: [
          {
            type: "ol",
            items: [
              "Go to the client profile. Click the Activity tab.",
              "Click Add Note. Type your note in the text area.",
              "Click Save. The note is saved and appears in the feed below.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "onboarding-checklist",
    title: "Onboarding Checklist",
    articles: [
      {
        id: "understanding-checklist",
        title: "Understanding the checklist",
        body:
          "welcome packet portal signed poa collection letter complete incomplete bypass milestones",
        blocks: [
          {
            type: "p",
            text: "The checklist tracks 4 key milestones for every client:",
          },
          {
            type: "ol",
            items: [
              "Send Welcome Packet + POA — FedEx",
              "Enable Client Portal Access — send them a login invite",
              "Signed POA Received — upload the signed document",
              "Collection Letter Received — triggers attorney handoff automatically",
            ],
          },
          {
            type: "p",
            text: "Items marked green are Complete. Red means Incomplete. Yellow means Bypassed by an administrator.",
          },
        ],
      },
      {
        id: "welcome-packet-step",
        title: "How to send the welcome packet (Step 1)",
        body:
          "welcome packet poa fedex sunday wednesday batch resend envelope verify email",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Send Welcome Packet + POA in the checklist.",
              "If FedEx was selected: the client is already queued for the next Sunday or Wednesday batch. Confirm the batch date shown.",
              "If digital delivery was configured by the office, follow the instructions your team sent.",
              "Verify the pre-filled name and email are correct.",
              "Click Send Envelope.",
              "If the client needs a resend: click Resend Packet and choose FedEx.",
            ],
          },
        ],
      },
      {
        id: "portal-access-step",
        title: "How to enable client portal access (Step 2)",
        body:
          "portal invite link password portal checklist complete login",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Enable Client Portal Access in the checklist.",
              "Click Send Portal Invite.",
              "Copy the invite link and share it with the client via email or text message.",
              "The client clicks the link, sets their own password, and can log into their portal using your organization's link.",
              "The checklist item marks Complete once they log in.",
            ],
          },
        ],
      },
      {
        id: "signed-poa-step",
        title: "How to record a signed POA (Step 3)",
        body:
          "signed poa upload pdf checklist resend packet upload button",
        blocks: [
          {
            type: "ol",
            items: [
              "When the signed POA arrives back from the client:",
              "Click Signed POA Received in the checklist.",
              "Click Upload.",
              "Select the signed PDF file.",
              "Click Upload. The checklist marks Complete automatically.",
              "If the client needs the packet resent before signing: click Resend Packet next to the upload button.",
            ],
          },
        ],
      },
      {
        id: "collection-letter-step",
        title: "Collection Letter Received (Step 4)",
        body:
          "documents upload collection letter automatic attorney notify advance stage checklist do not manual",
        blocks: [
          {
            type: "p",
            text: "You do NOT trigger this manually.",
          },
          {
            type: "p",
            text: "When you upload a collection letter in the Uploads tab, this checklist item completes automatically AND the client advances to Case Sent to Attorneys AND the attorney is notified.",
          },
          {
            type: "p",
            text: "See: How to upload a collection letter.",
          },
          {
            type: "callout",
            variant: "warning",
            text: "Always choose the correct card association when uploading — routing and notifications depend on it.",
          },
        ],
      },
    ],
  },
  {
        id: "communications",
    title: "Communications",
    articles: [
      {
        id: "log-call",
        title: "How to log a call",
        body:
          "activity tab add call inbound outbound date time notes save feed",
        blocks: [
          {
            type: "ol",
            items: [
              "Go to the client profile. Click the Activity tab.",
              "Click Add Call.",
              "Select Inbound (they called you) or Outbound (you called them).",
              "Set the date and time.",
              "Write your call notes in the Notes field — be detailed.",
              "Click Save. The call appears in the feed immediately.",
            ],
          },
        ],
      },
      {
        id: "log-text",
        title: "How to log a text message",
        body:
          "add text inbound outbound paste message save activity",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Add Text in the Activity tab.",
              "Select Inbound or Outbound.",
              "Paste or type the message content.",
              "Click Save.",
            ],
          },
        ],
      },
      {
        id: "log-email",
        title: "How to log an email",
        body:
          "add email inbound outbound subject body template save activity",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Add Email in the Activity tab.",
              "Select Inbound or Outbound.",
              "Add the subject line.",
              "Paste or type the email body.",
              "To use a template: click Use Template dropdown and select one.",
              "Edit the pre-filled content as needed.",
              "Click Save.",
            ],
          },
        ],
      },
      {
        id: "message-templates-use",
        title: "How to use message templates",
        body:
          "template dropdown merge tags client_name first_name tracking_number",
        blocks: [
          {
            type: "ol",
            items: [
              "When logging an email or text, click the Use Template dropdown.",
              "Select the template you want.",
              "The subject and body auto-fill with merge tags replaced:",
            ],
          },
          {
            type: "ul",
            items: [
              "{{client_name}} becomes the client's full name",
              "{{first_name}} becomes their first name",
              "{{tracking_number}} becomes their tracking number",
            ],
          },
          {
            type: "p",
            text: "Edit the content before saving if needed.",
          },
        ],
      },
      {
        id: "ringcentral-auto",
        title: "RingCentral auto-logging",
        body:
          "ringcentral connected admin automatic calls texts indicator communications green",
        blocks: [
          {
            type: "p",
            text: "If RingCentral is connected by your admin, calls and texts to and from client phone numbers log automatically.",
          },
          {
            type: "p",
            text: "You will see a green RingCentral active indicator in the Activity tab when this is working.",
          },
          {
            type: "p",
            text: "You do not need to manually log calls that RingCentral captures.",
          },
          {
            type: "callout",
            variant: "note",
            text: "If something did not capture, log it manually so the file stays complete.",
          },
        ],
      },
      {
        id: "portal-message-client",
        title: "How to message a client through their portal",
        body:
          "portal messages tab communications client messages send sidebar",
        blocks: [
          {
            type: "ol",
            items: [
              "Go to the client profile. Click the Portal Messages tab.",
              "Type your message in the input box at the bottom.",
              "Click Send. The client sees your message in their portal immediately.",
              "You can also go to Communications in the sidebar, click Client Messages tab, find the client, and reply there.",
            ],
          },
        ],
      },
      {
        id: "team-dm",
        title: "How to send a team direct message",
        body:
          "communications team chat sidebar unread badge green send",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Communications in the sidebar.",
              "Click Team Chat tab.",
              "Find the team member you want to message on the left.",
              "Type your message and click Send.",
              "Unread messages show a green badge on their name.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "documents",
    title: "Uploads",
    articles: [
      {
        id: "upload-document",
        title: "How to upload a document",
        body:
          "uploads tab upload type pdf jpg png mp3 mp4 m4a drag drop notes",
        blocks: [
          {
            type: "ol",
            items: [
              "Go to the client profile. Click the Uploads tab.",
              "Click Upload +.",
              "Select the document type from the dropdown.",
              "Choose your file — supported formats: PDF, JPG, PNG, MP3, MP4, M4A.",
              "You can drag and drop the file or click Choose File.",
              "Add notes if needed.",
              "Click Upload. The file appears in the list immediately.",
            ],
          },
        ],
      },
      {
        id: "upload-collection-letter-doc",
        title: "How to upload a collection letter",
        body:
          "collection letter document type card attach attorney notify advance checklist pdf",
        blocks: [
          {
            type: "ol",
            items: [
              "Go to the Uploads tab.",
              "Click Upload +.",
              "Select Collection Letter as the document type.",
              "A second dropdown appears — select which card on file this letter belongs to. This is required.",
              "Upload the PDF.",
            ],
          },
          {
            type: "p",
            text: "This automatically:",
          },
          {
            type: "ul",
            items: [
              "Attaches the letter to the selected card",
              "Advances the client to Case Sent to Attorneys",
              "Notifies the assigned attorney by email",
              "Marks Collection Letter Received on the checklist",
            ],
          },
          {
            type: "p",
            text: "You do not need to do anything else after uploading.",
          },
        ],
      },
      {
        id: "download-document",
        title: "How to download a document",
        body:
          "uploads download button secure link file",
        blocks: [
          {
            type: "ol",
            items: [
              "In the Uploads tab, find the file you need.",
              "Click the Download button next to it.",
              "A secure download link opens. The file downloads to your device.",
            ],
          },
        ],
      },
      {
        id: "supported-file-types",
        title: "Supported file types",
        body:
          "pdf jpg png mp3 mp4 m4a voice screenshot maximum size file storage",
        blocks: [
          {
            type: "ul",
            items: [
              "PDF — client agreements, letters, POA documents",
              "JPG/PNG — screenshots of correspondence, ID photos",
              "MP3/MP4/M4A — voice recordings and audio notes",
            ],
          },
          {
            type: "p",
            text: "Maximum file size depends on your organization's storage limits.",
          },
          {
            type: "callout",
            variant: "note",
            text: "When in doubt, use PDF for anything legal or signed.",
          },
        ],
      },
    ],
  },
  {
    id: "fedex-welcome",
    title: "FedEx & Welcome Packets",
    articles: [
      {
        id: "monitor-fedex-batches",
        title: "How to monitor FedEx batches",
        body:
          "fedex batches admin sidebar ready to send tracking sunday wednesday 11pm pst automatic",
        blocks: [
          {
            type: "ol",
            items: [
              "Click FedEx Batches in the sidebar.",
              "Ready to Send: clients queued for the next batch.",
              "Sent — Awaiting Tracking: clients sent, waiting for tracking number.",
              "Tracking Received: clients with an active tracking number.",
              "Batches send automatically every Sunday and Wednesday at 11PM PST.",
            ],
          },
        ],
      },
      {
        id: "check-fedex-status",
        title: "How to check a client's FedEx status",
        body:
          "fedex print partner zb0001 poll status tracking link portal client",
        blocks: [
          {
            type: "ol",
            items: [
              "In FedEx Batches, find the client in Sent — Awaiting Tracking.",
              "If a Print Partner ID (ZB0001 format) is shown, click Poll Status to check for a tracking number.",
              "Once tracking appears, click the tracking link to open the carrier’s site.",
              "The client can also see their tracking in their portal.",
            ],
          },
        ],
      },
      {
        id: "packet-not-received",
        title: "What to do if a client didn't receive their packet",
        body:
          "checklist welcome packet resend fedex confirm logged",
        blocks: [
          {
            type: "ol",
            items: [
              "Go to the client profile.",
              "In the checklist, click Send Welcome Packet + POA.",
              "Click Resend Packet.",
              "Choose FedEx (new physical copy).",
              "Confirm. The resend is logged automatically.",
            ],
          },
          {
            type: "callout",
            variant: "warning",
            text: "Confirm the client’s mailing address on the Account tab before paying for another FedEx send.",
          },
        ],
      },
    ],
  },
  {
    id: "client-portal-help",
    title: "Client Portal",
    articles: [
      {
        id: "portal-invite-send",
        title: "How to send a portal invite",
        body:
          "portal invite checklist enable access link email text portal password",
        blocks: [
          {
            type: "ol",
            items: [
              "On the client profile, go to the checklist.",
              "Click Enable Client Portal Access.",
              "Click Send Portal Invite.",
              "Copy the invite link.",
              "Send it to the client via email or text.",
              "They click the link, set their password, and log in through your organization's portal",
            ],
          },
        ],
      },
      {
        id: "what-clients-see",
        title: "What clients can see in their portal",
        body:
          "portal progress tracker tracking number carrier documents messages billing internal notes hidden",
        blocks: [
          {
            type: "p",
            text: "Clients see:",
          },
          {
            type: "ul",
            items: [
              "Their 7-step case progress tracker",
              "Tracking number / carrier status (if applicable)",
              "Their uploaded documents (download only)",
              "Messages with your team",
            ],
          },
          {
            type: "p",
            text: "They cannot see billing information or internal notes.",
          },
        ],
      },
      {
        id: "message-client-portal-tab",
        title: "How to message a client in their portal",
        body:
          "portal messages communications client messages tab send notify",
        blocks: [
          {
            type: "ol",
            items: [
              "Go to the client profile. Click Portal Messages tab.",
              "Or go to Communications → Client Messages tab.",
              "Type your message and click Send.",
              "The client is notified in their portal.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "reminders-page",
    title: "Appointments Page",
    articles: [
      {
        id: "use-reminders-page",
        title: "How to use the Appointments page",
        body:
          "appointments sidebar overdue today upcoming checkmark add appointment assign",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Appointments in the sidebar.",
              "Overdue tab: appointments past their due date — handle these first.",
              "Today tab: appointments due today.",
              "Upcoming tab: future appointments to plan ahead.",
              "Click the green checkmark to mark complete.",
              "Click Add Appointment to create one from this page.",
            ],
          },
        ],
      },
      {
        id: "add-reminder-from-page",
        title: "How to add an appointment from the Appointments page",
        body:
          "add appointment button client search assign team member save due date",
        blocks: [
          {
            type: "ol",
            items: [
              "Click Add Appointment button top right.",
              "Search for and select the client.",
              "Enter appointment details, due date, and time.",
              "Assign to yourself or another team member.",
              "Click Save.",
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Assigning to the person who owns the client keeps accountability clear on the dashboard.",
          },
        ],
      },
    ],
  },
];
