/*
 * Interactive lessons: set demo_url for the Arcade embed.
 * Course catalog: lib/help/guides-index.ts (COURSE_LESSONS).
 */

export interface GuideStep {
  title: string;
  description: string;
  location: string;
  screenshotDescription: string;
  tip?: string;
  warning?: string;
}

export interface Guide {
  slug: string;
  title: string;
  demo_url?: string | null;
  intro: string;
  lesson_number?: number;
  admin_only?: boolean;
  steps: GuideStep[];
}

/** Short helper for guides that share a simple pattern */
function mk(
  title: string,
  description: string,
  location: string,
  shot: string,
  extra?: Partial<Pick<GuideStep, "tip" | "warning">>
): GuideStep {
  return { title, description, location, screenshotDescription: shot, ...extra };
}

export const GUIDE_CONTENT: Record<string, Guide> = {
  "getting-started": {
    slug: "getting-started",
    title: "Getting Started — Add Your First Client",
    demo_url: "https://app.arcade.software/share/7JRlcldaBF05CKHZQa7A",
    intro:
      "Learn how to add a new client and set up their notes and appointments.",
    lesson_number: 1,
    steps: [],
  },
  "welcome-packet-fedex": {
    slug: "welcome-packet-fedex",
    title: "Welcome Packet & Tracking Number",
    demo_url: "https://app.arcade.software/share/XLhkA7ciWAbSK36ZkLxC",
    intro: "Send welcome packets and track shipments.",
    lesson_number: 2,
    steps: [],
  },
  "working-the-checklist": {
    slug: "working-the-checklist",
    title: "Working the Checklist",
    demo_url: "https://app.arcade.software/share/iV30RN16cRQ8EB2wsANR",
    intro:
      "Complete client onboarding and document delivery — work through the checklist and follow the interactive walkthrough below.",
    lesson_number: 3,
    steps: [],
  },
  "logging-communications": {
    slug: "logging-communications",
    title: "Logging Communications",
    demo_url: "https://app.arcade.software/share/fGHnTULPw0dyLUIM83x3",
    intro: "Log calls, texts, emails and notes for every client interaction.",
    lesson_number: 4,
    steps: [],
  },
  "managing-team-pipeline": {
    slug: "managing-team-pipeline",
    title: "Managing Your Team & Pipeline",
    demo_url: "https://app.arcade.software/share/g8cNqlpXZr248Tc6lte8",
    intro:
      "Manage team members and announcements in the CRM, and oversee the pipeline — follow the interactive walkthrough below.",
    lesson_number: 5,
    steps: [],
    admin_only: true,
  },
  "add-new-client": {
    slug: "add-new-client",
    title: "Adding a new client",
    demo_url: "https://app.arcade.software/share/7JRlcldaBF05CKHZQa7A",
    intro: "This guide walks you through creating a new lead in the system from start to finish.",
    steps: [
      mk(
        "Go to the Clients page",
        'Click "Clients" in the left sidebar. This shows you all clients in the system.',
        "Sidebar → Clients",
        "Sidebar with Clients highlighted"
      ),
      mk(
        "Click Add New Client",
        'Find the green "Add New Client" button in the top right corner of the page and click it.',
        "Clients page → Top right → Add New Client button",
        "Clients page with Add New Client button highlighted",
        { tip: "You can also click Add New Client from the Dashboard" }
      ),
      mk(
        "Fill in the client name",
        "Enter the Primary First Name and Primary Last Name. These are required. You can also add a nickname.",
        "Add New Client form → Client Information section",
        "Form showing Primary First Name and Last Name fields",
        {
          warning:
            "First Name and Last Name are required — you cannot save without them",
        }
      ),
      mk(
        "Add contact information",
        "Enter at least one phone number (Mobile, Work, or Home) and an email address. Choose their preferred contact method.",
        "Add New Client form → Contact section",
        "Form showing phone and email fields"
      ),
      mk(
        "Enter the client address",
        "Start typing in the Street Address field. Suggestions will appear — click the correct address to auto-fill City, State, and ZIP.",
        "Add New Client form → Address section",
        "Address field with autocomplete dropdown showing",
        {
          tip: "The address autocomplete fills City, State, and ZIP automatically when you select a suggestion",
        }
      ),
      mk(
        "Assign and submit",
        "Choose an Assigned User from the dropdown, then click Submit. The client is created as a New Lead and you are taken to their profile.",
        "Add New Client form → Case Details → Submit button",
        "Form bottom showing Assigned User dropdown and Submit button",
        { tip: "Auto appointments are created when you advance the client to the next stage" }
      ),
    ],
  },
  "add-notes-appointments": {
    slug: "add-notes-appointments",
    title: "Adding Notes & Appointments",
    demo_url: "https://app.arcade.software/share/fGHnTULPw0dyLUIM83x3",
    intro: "Learn how to log notes and schedule appointments for your clients.",
    steps: [
      {
        title: "Open the client profile",
        description:
          "Find your client in the Clients list and click their name to open their profile.",
        location: "Sidebar → Clients → Client Name",
        screenshotDescription: "Client profile open showing right sidebar",
      },
      {
        title: "Add a note from the sidebar",
        description:
          "In the right sidebar, find the Notes section. Click the + icon to open the note popup. Type your note and click Save.",
        location: "Client Profile → Right Sidebar → Notes → + icon",
        screenshotDescription: "Notes section with add note modal open",
        tip: "Notes are also accessible from the Activity tab",
      },
      {
        title: "Add an appointment",
        description:
          "Click Add+ next to Appointments in the sidebar. Use the Quick appointment dropdown to select a preset, or type a custom appointment. Set the date and time then click Save.",
        location: "Client Profile → Right Sidebar → Appointments → Add+",
        screenshotDescription: "Appointments section with quick select dropdown showing",
        tip: "Quick appointments automatically set the due date based on the appointment type",
      },
    ],
  },
  "upload-collection-letter": {
    slug: "upload-collection-letter",
    title: "Uploading a Collection Letter",
    intro: "Uploading a collection letter is the most important action in the system — it automatically triggers the attorney handoff.",
    steps: [
      mk(
        "Open the client profile",
        "Find the client in the Clients list and click their name.",
        "Sidebar → Clients → Client Name",
        "Clients list with client highlighted"
      ),
      mk(
        "Go to the Uploads tab",
        "Click the Uploads tab in the client profile.",
        "Client Profile → Uploads tab",
        "Client profile with Uploads tab highlighted"
      ),
      mk(
        "Click Upload +",
        "Click the green Upload + button to open the upload form.",
        "Client Profile → Uploads tab → Upload + button",
        "Uploads tab with Upload + button highlighted"
      ),
      mk(
        "Select Collection Letter as the file type",
        "In the File Type dropdown, select Collection Letter.",
        "Upload modal → File Type dropdown",
        "Upload modal showing Collection Letter selected"
      ),
      mk(
        "Choose the file and upload",
        "Choose the PDF file, then click Upload.",
        "Upload modal → Choose File → Upload",
        "Upload modal with file chosen",
        { tip: "Drag and drop the file directly onto the upload area" }
      ),
      mk(
        "What happens automatically",
        "The system automatically: moves the client to Case Sent to Attorneys, notifies the assigned attorney, marks Collection Letter Received complete, and creates a Case Sent Call appointment.",
        "This happens automatically — no action needed",
        "Client profile showing Case Sent to Attorneys stage and completed checklist",
        {
          tip: "The attorney sees a red badge on their Cases page showing they have a new case",
        }
      ),
    ],
  },
  "fedex-batch-manager": {
    slug: "fedex-batch-manager",
    title: "Using the FedEx Batch Manager",
    demo_url: "https://app.arcade.software/share/XLhkA7ciWAbSK36ZkLxC",
    intro: "The FedEx Batch Manager shows which clients need their welcome packet shipped and tracks delivery status.",
    steps: [
      mk(
        "Open FedEx Batches",
        "Click FedEx Batches in the left sidebar.",
        "Sidebar → FedEx Batches",
        "Sidebar with FedEx Batches highlighted"
      ),
      mk(
        "Check the deadline countdown",
        "At the top you see a countdown to the next batch deadline. Batches send every Sunday and Wednesday at 5PM Pacific.",
        "FedEx Batches page → top countdown banner",
        "FedEx Batches page showing green countdown banner",
        { tip: "Clients are automatically added to Ready to Send when their card is charged" }
      ),
      mk(
        "Review Ready to Send",
        "The Ready to Send section shows clients waiting for their packet to be shipped. Review the list before sending.",
        "FedEx Batches → Ready to Send section",
        "Ready to Send table with client rows"
      ),
      mk(
        "Click Send Batch to Print",
        "Click the Send Batch to Print button to send all ready clients to the print partner. You will see a confirmation message.",
        "FedEx Batches → Ready to Send → Send Batch to Print button",
        "Send Batch to Print button highlighted with success message",
        { warning: "Make sure all client addresses are complete before sending" }
      ),
      mk(
        "Sync Print IDs",
        "After sending, click Sync IDs from Print Partner. This automatically pulls the Print IDs assigned by the printer.",
        "FedEx Batches → Sync IDs from Print Partner button",
        "Sync IDs button with success toast showing records synced",
        { tip: "IDs sync automatically every 3 hours — the button forces an immediate sync" }
      ),
      mk(
        "Monitor tracking",
        "In the Sent — Awaiting Tracking section, click Check Tracking Updates to refresh tracking status. Status updates from Received by printer → Shipped → Delivered.",
        "FedEx Batches → Sent — Awaiting Tracking → Check Tracking Updates",
        "Awaiting Tracking table showing colored status badges",
        {
          tip: "Tracking auto-updates every 3 hours. When status shows Delivered, the client automatically moves to Awaiting Collection Letter",
        }
      ),
    ],
  },
  "send-welcome-packet": {
    slug: "send-welcome-packet",
    title: "Sending the Welcome Packet",
    intro: "When a client moves to the Welcome Packet stage, their packet is queued for the next FedEx batch automatically.",
    steps: [
      mk(
        "Advance client to Welcome Packet stage",
        "On the client profile, click the green Advance button at the top. A popup asks how they want to receive their packet.",
        "Client Profile → top header → Advance button",
        "Client profile header showing Advance button"
      ),
      mk(
        "Select Via FedEx",
        "Click the Via FedEx button. The client is automatically queued for the next Sunday or Wednesday batch.",
        "Delivery method popup → Via FedEx button",
        "Delivery method popup showing Via FedEx button",
        { tip: "The client appears in Ready to Send on the FedEx Batches page immediately" }
      ),
      mk(
        "Check the checklist",
        "Click Send Welcome Packet + POA in the checklist on the right side. You can see the current FedEx queue status.",
        "Client Profile → right sidebar → Checklist → Send Welcome Packet + POA",
        "Checklist showing Send Welcome Packet item with FedEx queue status"
      ),
      mk(
        "Monitor delivery",
        "Go to FedEx Batches to track when the packet ships and is delivered. The client automatically advances to Awaiting Collection Letter when delivered.",
        "Sidebar → FedEx Batches → Sent — Awaiting Tracking",
        "FedEx Batches page showing client in awaiting tracking",
        { tip: "The client can also track their package in their own portal" }
      ),
    ],
  },
  "log-a-call": {
    slug: "log-a-call",
    title: "Logging a call",
    intro: "Always log calls immediately after hanging up so nothing gets forgotten.",
    steps: [
      mk(
        "Open the client profile",
        "Find the client and open their profile.",
        "Sidebar → Clients → Client Name",
        "Client profile open"
      ),
      mk(
        "Click the Activity tab",
        "Click Activity — it is the third tab from the left.",
        "Client Profile → Activity tab",
        "Client profile with Activity tab highlighted"
      ),
      mk(
        "Click Add Call",
        "Click the blue Add Call button. A popup opens with fields for the call details.",
        "Activity tab → Add Call button",
        "Add Call button and popup modal"
      ),
      mk(
        "Fill in the details and save",
        "Select Inbound (they called you) or Outbound (you called them). Set the date and time. Write your call notes. Click Save.",
        "Add Call modal → fill fields → Save",
        "Add Call modal with fields filled in",
        {
          tip: "If RingCentral is connected, calls log automatically — you may not need to do this manually",
        }
      ),
    ],
  },
  "attorney-view-cases": {
    slug: "attorney-view-cases",
    title: "Viewing your assigned cases",
    intro: "Cases appear automatically when the team sends them to you. You will see a notification badge when new cases arrive.",
    steps: [
      mk(
        "Check for the red badge",
        "When you log in, check the Cases link in the left sidebar. A red number badge means you have new cases to review.",
        "Sidebar → Cases → red badge",
        "Attorney sidebar showing Cases with red badge"
      ),
      mk(
        "Open your cases list",
        "Click Cases to see all cases assigned to you.",
        "Sidebar → Cases",
        "Attorney cases list showing client rows"
      ),
      mk(
        "Click View on a case",
        "Click View next to any case to see the full case details including all documents and collection letters.",
        "Cases list → View button",
        "Case detail page showing documents and letters",
        {
          tip: "You can download any document or collection letter directly from this page",
        }
      ),
    ],
  },
  "invite-team-member": {
    slug: "invite-team-member",
    title: "Inviting a team member",
    intro: "Only Admins and Developers can invite new team members. They receive a temporary password to log in for the first time.",
    steps: [
      mk(
        "Go to the Team page",
        "Click Team in the left sidebar.",
        "Sidebar → Team",
        "Team page showing list of members"
      ),
      mk(
        "Click Invite Team Member",
        "Click the green Invite Team Member button in the top right.",
        "Team page → top right → Invite Team Member",
        "Team page header with Invite Team Member button highlighted"
      ),
      mk(
        "Fill in their details",
        "Enter their Full Name, Email address, and select their Role (Admin, User, or Attorney).",
        "Invite modal → fill in fields",
        "Invite modal with name, email, and role fields",
        { warning: "Use their work email address — this is how they will log in" }
      ),
      mk(
        "Click Send Invite",
        "Click Send Invite. The account is created immediately.",
        "Invite modal → Send Invite button",
        "Invite modal with Send Invite button"
      ),
      mk(
        "Share the credentials",
        "A success message shows their email and temporary password. Click Copy Credentials and share it with them securely.",
        "Success modal → Copy Credentials button",
        "Success modal showing email and temporary password",
        { tip: "They should change their password in Settings after their first login" }
      ),
    ],
  },
  "understanding-dashboard": {
    slug: "understanding-dashboard",
    title: "Understanding your dashboard",
    intro: "Your dashboard is the home screen after you log in. It shows numbers that help you see how work is going at a glance.",
    steps: [
      mk(
        "Open the Dashboard",
        "Click Dashboard in the left sidebar if you are not already there.",
        "Sidebar → Dashboard",
        "Dashboard page overview"
      ),
      mk(
        "Read the stat cards",
        "Each card shows a count — like new leads or clients waiting on something. Read the label under each number to know what it means.",
        "Dashboard → stat cards row",
        "Stat cards with labels visible"
      ),
      mk(
        "Use quick links",
        "Many cards or buttons let you jump to a filtered list. Click them when you want to work that queue.",
        "Dashboard → links or buttons on cards",
        "Dashboard with a highlighted navigation link"
      ),
      mk(
        "Check appointments",
        "Look for upcoming tasks or appointments so you know who to call or follow up with today.",
        "Dashboard → appointments section (if shown)",
        "Appointments or activity section on dashboard",
        { tip: "You can also open Appointments in the sidebar for the full list" }
      ),
    ],
  },
  "pipeline-sales-vs-service": {
    slug: "pipeline-sales-vs-service",
    title: "Sales vs Service Pipeline",
    intro: "The Pipeline page can show sales-focused stages or service-focused stages so you can track clients the way you work.",
    steps: [
      mk(
        "Open Pipeline",
        "Click Pipeline in the left sidebar.",
        "Sidebar → Pipeline",
        "Pipeline board page"
      ),
      mk(
        "See the columns",
        "Each column is a stage. Clients appear as cards inside the stage they are in right now.",
        "Pipeline → columns (stages)",
        "Kanban columns with cards"
      ),
      mk(
        "Switch views if available",
        "If your workspace offers Sales vs Service views, use the toggle or tabs at the top to switch.",
        "Pipeline → view toggle or tabs",
        "Top of pipeline with view switcher"
      ),
      mk(
        "Move a card",
        "Drag a client card to a new column when their stage changes, or open the client and use Advance in their profile.",
        "Pipeline → drag card or client profile",
        "Dragging a card between columns"
      ),
      mk(
        "Open a client",
        "Click a card to open that client's profile and work their checklist or open the Activity tab.",
        "Pipeline → click client card",
        "Client profile opened from pipeline",
        { tip: "Colors on cards often show how long they have been in a stage" }
      ),
    ],
  },
  "find-a-client": {
    slug: "find-a-client",
    title: "Finding a client",
    intro: "Use search and filters on the Clients page to find someone fast.",
    steps: [
      mk(
        "Go to Clients",
        "Click Clients in the left sidebar.",
        "Sidebar → Clients",
        "Clients list page"
      ),
      mk(
        "Use the search box",
        "Type part of a name, email, or phone. The list narrows as you type.",
        "Clients page → search field",
        "Search input with filtered results"
      ),
      mk(
        "Open the profile",
        "Click the client's row to open their full profile.",
        "Clients list → client row",
        "Client profile",
        { tip: "Use tabs at the top of the list (All, Active, etc.) to narrow the pool first" }
      ),
    ],
  },
  "advance-client-stage": {
    slug: "advance-client-stage",
    title: "Advancing a client stage",
    intro: "Moving a client forward updates the pipeline and can unlock checklist steps.",
    steps: [
      mk(
        "Open the client",
        "Find the client from Clients and open their profile.",
        "Sidebar → Clients → Client Name",
        "Client profile header"
      ),
      mk(
        "Find the Advance control",
        "At the top of the profile, look for the green Advance button (or similar stage control).",
        "Client Profile → header → Advance",
        "Advance button in header"
      ),
      mk(
        "Choose options if asked",
        "Some stages ask how mail is sent or other choices. Pick the option that matches what really happened.",
        "Advance popup or modal",
        "Delivery or stage confirmation popup"
      ),
      mk(
        "Confirm the new stage",
        "Save or confirm. The header stage name updates and the checklist may show new tasks.",
        "Client Profile → after advance",
        "Updated stage label and checklist",
        { warning: "Make sure the client really completed the requirements for this stage before advancing" }
      ),
    ],
  },
  "revert-client-stage": {
    slug: "revert-client-stage",
    title: "Reverting a client stage",
    intro: "If a client was moved forward by mistake, you can move them back when your role allows it.",
    steps: [
      mk(
        "Open the client profile",
        "Go to Clients and click the client.",
        "Sidebar → Clients → Client Name",
        "Client profile"
      ),
      mk(
        "Use Revert in the header",
        "If you see a Revert or similar control near the stage, click it. You may need to pick the stage to go back to.",
        "Client Profile → header → Revert",
        "Revert control near stage name"
      ),
      mk(
        "Confirm and review checklist",
        "Confirm the change. Review the checklist because some items may need to be done again.",
        "Client Profile → checklist",
        "Checklist after revert",
        { tip: "If you do not see Revert, ask an admin — some roles cannot revert stages" }
      ),
    ],
  },
  "enable-portal-access": {
    slug: "enable-portal-access",
    title: "Enabling client portal access",
    intro: "Clients can log in to their own portal to see progress and messages once access is turned on and they receive an invite.",
    steps: [
      mk(
        "Open the client Account tab",
        "Go to the client's profile and click the Account tab.",
        "Client Profile → Account tab",
        "Account tab with portal section"
      ),
      mk(
        "Turn on portal access",
        "Find the portal access toggle or checkbox and turn it on. Save the form if required.",
        "Account tab → Portal access",
        "Portal access toggle enabled"
      ),
      mk(
        "Send the invite",
        "Use Send portal invite (or similar) from the checklist or account area so the client gets email instructions.",
        "Account tab or checklist → Send portal invite",
        "Invite sent confirmation or button state",
        { tip: "The client should use the link in the email the first time they sign in" }
      ),
      mk(
        "Tell the client what to expect",
        "Let them know they will create a password and can message you from the portal.",
        "—",
        "Sample client communication",
        { warning: "Never share your own staff password with a client" }
      ),
    ],
  },
  "upload-signed-poa": {
    slug: "upload-signed-poa",
    title: "Uploading a signed POA",
    intro: "Upload the signed Power of Attorney so the file is stored on the client record.",
    steps: [
      mk(
        "Open Uploads",
        "From the client profile, click the Uploads tab.",
        "Client Profile → Uploads tab",
        "Uploads tab"
      ),
      mk(
        "Start an upload",
        "Click Upload + and choose the document type that matches a POA (or General) if POA is not listed.",
        "Uploads tab → Upload +",
        "Upload modal open"
      ),
      mk(
        "Pick the PDF",
        "Choose the signed PDF from your computer and upload.",
        "Upload modal → file picker",
        "File selected ready to upload"
      ),
      mk(
        "Verify on the list",
        "After upload, confirm the document appears in the table with the right type and date.",
        "Uploads tab → document list",
        "Uploaded POA row in table",
        { tip: "You can open the file from the list to double-check it is the correct scan" }
      ),
    ],
  },
  "log-a-text": {
    slug: "log-a-text",
    title: "Logging a text message",
    intro: "Save a text conversation on the client timeline the same way you log a call.",
    steps: [
      mk(
        "Open Activity",
        "Go to the client profile and click the Activity tab.",
        "Client Profile → Activity tab",
        "Activity tab"
      ),
      mk(
        "Click Add Text",
        "Open the add text flow and enter direction, time, and what was said in simple words.",
        "Activity → Add Text",
        "Add text modal"
      ),
      mk(
        "Save",
        "Click Save so the text appears in the timeline for everyone on the team.",
        "Add Text → Save",
        "Timeline with new text entry",
        { tip: "Paste long threads into the notes field if that is easier than summarizing" }
      ),
    ],
  },
  "log-an-email": {
    slug: "log-an-email",
    title: "Logging an email",
    intro: "Record outbound or inbound email so the team sees it on the client record.",
    steps: [
      mk(
        "Open Activity",
        "Open the client profile and go to the Activity tab.",
        "Client Profile → Activity tab",
        "Activity tab"
      ),
      mk(
        "Click Add Email",
        "Start the add email form. Pick a template if you want starter text.",
        "Activity → Add Email",
        "Add email modal"
      ),
      mk(
        "Fill subject and body",
        "Enter what the email was about. Keep it short but clear enough for someone else to understand later.",
        "Add Email form",
        "Filled subject and body fields"
      ),
      mk(
        "Save",
        "Click Save. The email line appears in the activity list.",
        "Add Email → Save",
        "Timeline showing logged email"
      ),
    ],
  },
  "team-chat": {
    slug: "team-chat",
    title: "Using Team Chat",
    intro: "Team Chat lets you send direct messages to another staff member inside the CRM.",
    steps: [
      mk(
        "Open Communications hub",
        "Click Communications in the sidebar, then choose the Team Chat tab.",
        "Sidebar → Communications → Team Chat",
        "Team chat layout with peer list"
      ),
      mk(
        "Pick a teammate",
        "Click a person in the list on the left to open your thread with them.",
        "Team Chat → peer list",
        "Conversation thread open"
      ),
      mk(
        "Send your message",
        "Type in the box and send. Use Enter to send or Shift+Enter for a new line depending on the hint shown.",
        "Team Chat → message box",
        "Message sent in thread",
        { tip: "You can attach images or PDFs from the icons next to the message box" }
      ),
    ],
  },
  "department-channels": {
    slug: "department-channels",
    title: "Department channels",
    intro: "Post updates in shared channels like Compliance or Client Services so the right group sees them.",
    steps: [
      mk(
        "Open Departments tab",
        "In Communications, click the Departments tab.",
        "Communications → Departments",
        "Department channel list"
      ),
      mk(
        "Select a channel",
        "Click the channel that matches your topic, for example Compliance Verification.",
        "Departments → channel name",
        "Channel message history"
      ),
      mk(
        "Post your message",
        "Type and send. Everyone with access to that channel can read it.",
        "Department thread → composer",
        "New department message",
        { tip: "Some channels are only visible to certain roles — if you do not see one, ask an admin" }
      ),
    ],
  },
  "track-fedex-shipment": {
    slug: "track-fedex-shipment",
    title: "Tracking a shipment",
    intro: "Find tracking numbers and delivery status for welcome packets from the FedEx Batches page.",
    steps: [
      mk(
        "Open FedEx Batches",
        "Click FedEx Batches in the sidebar.",
        "Sidebar → FedEx Batches",
        "FedEx batches page"
      ),
      mk(
        "Find the client",
        "Look in Sent — Awaiting Tracking (or similar sections) for the client's row.",
        "FedEx Batches → tracking table",
        "Table row with client name"
      ),
      mk(
        "Read tracking status",
        "The table shows tracking numbers and colored status badges. Use Check Tracking Updates to refresh.",
        "FedEx Batches → Check Tracking Updates",
        "Updated status badges"
      ),
      mk(
        "Open carrier tracking if needed",
        "Click the tracking link on the number, or paste it into the carrier’s website for full details.",
        "External → carrier tracking",
        "Carrier public tracking page",
        { tip: "Delivered status here also updates the client in the CRM automatically" }
      ),
    ],
  },
  "resend-welcome-packet": {
    slug: "resend-welcome-packet",
    title: "Resending a welcome packet",
    intro: "If a packet was lost or returned, you can queue a replacement shipment for the client.",
    steps: [
      mk(
        "Open the client profile",
        "Find the client who needs a new packet.",
        "Sidebar → Clients → Client Name",
        "Client profile"
      ),
      mk(
        "Use checklist or stage controls",
        "From the checklist or header actions, choose the option to resend or re-queue the welcome packet (wording may vary).",
        "Client Profile → checklist or header",
        "Resend welcome packet action"
      ),
      mk(
        "Confirm FedEx again",
        "Choose FedEx if prompted so the client re-enters the print batch flow.",
        "Delivery method → FedEx",
        "FedEx confirmation"
      ),
      mk(
        "Verify on FedEx Batches",
        "Open FedEx Batches and confirm the client appears in Ready to Send or the right queue.",
        "FedEx Batches → Ready to Send",
        "Client visible in batch list",
        { warning: "Update the client's address first if mail was returned for a bad address" }
      ),
    ],
  },
  "send-portal-invite": {
    slug: "send-portal-invite",
    title: "Sending a portal invite",
    intro: "Clients receive an email link to create their portal password.",
    steps: [
      mk(
        "Enable portal access",
        "On the Account tab, turn on portal access for the client and save if needed.",
        "Account tab → portal toggle",
        "Portal access on"
      ),
      mk(
        "Send invite",
        "Click Send portal invite (from checklist or account area).",
        "Checklist or Account → Send portal invite",
        "Invite action clicked"
      ),
      mk(
        "Confirm success",
        "Wait for the success toast or message.",
        "Toast notification",
        "Success toast"
      ),
      mk(
        "Tell the client to check email",
        "Ask them to look in spam too. They must use the link to finish signup.",
        "—",
        "Client email inbox illustration",
        { tip: "You can resend an invite from the same button if the email expired" }
      ),
    ],
  },
  "message-client-in-portal": {
    slug: "message-client-in-portal",
    title: "Messaging a client in their portal",
    intro: "Portal messages show on the client record and in the client's portal inbox.",
    steps: [
      mk(
        "Open Communications hub",
        "Click Communications, then the Client Messages tab.",
        "Sidebar → Communications → Client Messages",
        "Client messages layout"
      ),
      mk(
        "Select the client",
        "Pick the client in the list to open the thread.",
        "Client Messages → client list",
        "Thread open"
      ),
      mk(
        "Send your reply",
        "Type your message and send. The client sees it when they log into the portal.",
        "Client Messages → composer",
        "Message sent",
        { tip: "Sensitive details should still follow your company's policy on what belongs in chat" }
      ),
    ],
  },
  "attorney-download-documents": {
    slug: "attorney-download-documents",
    title: "Downloading case documents",
    intro: "Open a case and download PDFs you need for review.",
    steps: [
      mk(
        "Open the case",
        "From Cases, click View on the matter you need.",
        "Cases → View",
        "Case detail page"
      ),
      mk(
        "Find the Files or documents area",
        "Scroll to the list of uploaded documents and collection letters.",
        "Case page → documents list",
        "List of PDFs"
      ),
      mk(
        "Download",
        "Click download or open in a new tab for each file you need.",
        "Document row → download",
        "Browser download bar",
        { tip: "If a link fails, refresh the page once and try again" }
      ),
    ],
  },
  "attorney-close-case": {
    slug: "attorney-close-case",
    title: "Closing a case",
    intro: "When your legal work is finished, mark the case so the team knows it is done.",
    steps: [
      mk(
        "Open the case",
        "Go to Cases and open the case you finished.",
        "Cases → View",
        "Case detail"
      ),
      mk(
        "Find Close or complete action",
        "Look for a Close case or Mark complete button (label may vary).",
        "Case page → close action",
        "Close button area"
      ),
      mk(
        "Confirm",
        "Confirm in the dialog. The case leaves your active list or shows as closed.",
        "Confirm dialog",
        "Case marked closed",
        { warning: "Only close when you are sure no further attorney work is required" }
      ),
    ],
  },
  "update-profile": {
    slug: "update-profile",
    title: "Updating your profile",
    intro: "Change your display name or password from Settings.",
    steps: [
      mk(
        "Open Settings",
        "Click Settings in the sidebar.",
        "Sidebar → Settings",
        "Settings page"
      ),
      mk(
        "Edit your name",
        "Update your full name field and save profile if that section exists.",
        "Settings → profile name",
        "Name field updated"
      ),
      mk(
        "Change password",
        "Enter new password twice and save. Log in again on other devices if needed.",
        "Settings → password fields",
        "Password updated confirmation",
        { tip: "Use a unique password you do not use on other websites" }
      ),
    ],
  },
  "message-templates": {
    slug: "message-templates",
    title: "Managing message templates",
    intro: "Templates speed up emails and texts you send often.",
    steps: [
      mk(
        "Open Templates",
        "Go to Settings → Templates (or Message templates) if your admin enabled it.",
        "Settings → Templates",
        "Templates list page"
      ),
      mk(
        "Create or edit",
        "Click add or edit on a template. Give it a clear name everyone will recognize.",
        "Templates → editor",
        "Template editor open"
      ),
      mk(
        "Write body and subject",
        "Use plain language. Add placeholders only if your admin showed you the allowed tokens.",
        "Editor → subject and body",
        "Filled template fields"
      ),
      mk(
        "Save and test",
        "Save the template. Send yourself a test from the CRM if that button exists.",
        "Templates → save",
        "Saved template row",
        { warning: "Broken placeholders can blank out an entire email — double-check tokens" }
      ),
    ],
  },
  "upload-collection-letter-demo": {
    slug: "upload-collection-letter-demo",
    title: "Uploading a Collection Letter",
    intro: "Interactive walkthrough coming soon. The full text guide will appear here when the lesson is ready.",
    steps: [
      mk(
        "Coming soon",
        "This step-by-step interactive lesson is being recorded. Check back soon.",
        "—",
        "Placeholder"
      ),
    ],
  },
  "fedex-batch-demo": {
    slug: "fedex-batch-demo",
    title: "FedEx Batch Manager",
    intro: "Interactive walkthrough coming soon. The full text guide will appear here when the lesson is ready.",
    steps: [
      mk(
        "Coming soon",
        "This step-by-step interactive lesson is being recorded. Check back soon.",
        "—",
        "Placeholder"
      ),
    ],
  },
};

export function getGuideContent(slug: string): Guide | undefined {
  return GUIDE_CONTENT[slug];
}
