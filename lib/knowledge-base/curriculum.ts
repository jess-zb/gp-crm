export const KNOWLEDGE_CATEGORIES = [
  "Start here",
  "Account Managers",
  "Client Services",
  "Working a client",
  "Admins",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export type CurriculumArticle = {
  category: KnowledgeCategory;
  title: string;
  sortOrder: number;
  body: string;
};

/** Starter articles from the first Knowledge Base. One of them is no longer true. */
export const RETIRED_KNOWLEDGE_TITLES = [
  "Creating a client and choosing a MID",
  "What the MID controls",
  "The Documents tab",
  "Leaving Account Manager",
  "Adding a MID and its documents",
  "Adding or editing a Knowledge Base article",
] as const;

export const KNOWLEDGE_CURRICULUM: CurriculumArticle[] = [
  {
    category: "Start here",
    title: "Learning Guide",
    sortOrder: 10,
    body: `This guide is for someone who has never used Golden Pathway before. You do not need to be good with computers. Read one article, do that job, then come back for the next one.

## Which section to open

1. Everyone starts with **Start here**.
2. If your job is Account Manager, open **Account Managers** next.
3. If your job is Client Services, open **Client Services** next.
4. **Working a client** is for both of those jobs. It is the page you live on.
5. **Admins** is only for people who set up the team, the documents, and the reports.

If you are not sure which job you have, read **Roles & Departments** before you do anything else.

## How an article is written

Each article has three kinds of help.

- A short explanation of what the screen is for.
- Numbered steps. Do them in order. Do not skip ahead.
- A picture of the real screen, so you can match what you see.

The pictures are of the live pages, not a drawing. Your screen may be light or dark. The buttons are in the same place either way. There is no separate video. The picture plus the numbered steps is the walkthrough.

## If you get stuck

1. Look at the left sidebar. The gold row is the page you are on.
2. Use the search button in the bottom-right corner. It is the magnifying glass. You can also press **Command** and **K** on a Mac, or **Control** and **K** on Windows.
3. Ask an admin. Do not guess on a stage change, a refund, or a signature.
`,
  },
  {
    category: "Start here",
    title: "Navigate System",
    sortOrder: 20,
    body: `After you sign in, the dark bar on the left is your map. The gold row is the page you are on.

![The dashboard](/kb/dashboard.png)

## The pages in Workspace

1. **Dashboard** is your home. It changes based on your job. Read the article for your job before you trust the numbers.
2. **Clients** is the list of people the company is working with.
3. **Pipeline** shows those people grouped by stage, like a board.
4. **Appointments** is the calendar and the list of calls and meetings.
5. **Knowledge Base** is this guide.

## The pages in Operations

You may not see every item. If a page is missing, your login is not allowed to open it. That is normal.

- **Team** is where an admin adds people and marks their department.
- **E-Sign Documents** is where an admin keeps each MID's signature files.
- **Attorney Queue** is where an admin hands cases to an attorney.
- **Reports** is for admins.
- **Settings** is your password, the light or dark look, and a few admin links.

## Your name at the bottom

Your first name is on the first line. Your role is on the second line, such as Admin, Attorney, or User. The sun and moon switch light and dark. The arrow signs you out.

## Two buttons in the bottom-right

1. The magnifying glass searches every client and jumps to a page. Type a name, a phone number, or a spouse's name.
2. The speech bubble opens messages with other staff. It is not email to the client.

Press **Escape** to close search or messages.
`,
  },
  {
    category: "Start here",
    title: "Roles & Departments",
    sortOrder: 30,
    body: `Two different labels decide what you can do. They are not the same thing.

## Role

The role is the second line under your name in the sidebar.

- **Admin** can see the whole book, the team, reports, refunds, and the attorney queue.
- **User** means you are staff. It does not tell you which clients are yours. Your department does that.
- **Attorney** does not use this sidebar. Attorneys sign in and land on **Cases**.
- **Client** is the person we serve. They use a separate portal. They never see this guide.

## Department

A department is a checkbox an admin sets on **Team** for a User. There are exactly two.

- **Account Managers** work the client while the file is in the Account Manager stage.
- **Client Services** work the client after that, until the signed POA is on file and the file can move on.

One person can be in both departments. Admins are already in both, so they show up on Account Manager and Client Services lists without those checkboxes. If you are in both, and you are not an admin, your dashboard is the Account Manager dashboard.

## What you should open

1. Look under your name.
2. If it says Admin, start with **What admins see**.
3. If it says User, ask an admin whether you are Account Managers, Client Services, or both. Then open that section.
4. If the dashboard says your department is not set up yet, stop and ask an admin to check **Team**. Do not create clients until that is fixed.
`,
  },
  {
    category: "Start here",
    title: "Word Dictionary",
    sortOrder: 40,
    body: `You will see the same words on every page. Here is what they mean in this company.

- **Client** is the person Golden Pathway is helping. Their spouse can be on the file too. The spouse is not a second client.
- **Stage** is where the file sits in the work. The usual path is New Lead, then Account Manager, then Client Services, then Awaiting Collections, then Case Sent to Attorneys.
- **MID** is a label on the client, such as Golden Pathway. It chooses which signature documents that client is offered. It does not hide the client from other staff. Everyone on the staff side can open every client.
- **Credit card authorization** is the signed card form. It must be on the file before the client leaves Account Manager.
- **POA** is the signed power of attorney. The signed Welcome Packet is stored as the POA. It must be on the file before the client leaves Client Services for Awaiting Collections.
- **Appointment** is a call or meeting on the calendar. It is not an email.
- **Drip** is an automatic email sequence. It is not a text message, and nothing is mailed on paper.
- **Archive** means the file is closed or inactive. It is still searchable.

There is no shipping, no tracking number, and no print vendor in this system. Documents go out for signature on the screen, or a staff member uploads a file that was already signed.
`,
  },
  {
    category: "Account Managers",
    title: "Your day as an Account Manager",
    sortOrder: 110,
    body: `This is the path for an Account Manager. Do the steps in order on a new file. Later articles explain each click.

1. Open **Dashboard** and read who is waiting on you.
2. Open **Clients** and choose **Add New Client** when someone new comes in. A MID and an Account Manager are required.
3. Open the client. Check the phone, email, address, and verbal password on the left.
4. Get the **credit card authorization** signed or uploaded. Until that file is on Documents, the client cannot leave Account Manager.
5. Book the next call on **Appointments**.
6. When the card authorization is on file, move the stage to Client Services and make sure a Client Services person is assigned.

You do not send paper packets. You do not need a signed Welcome Packet to leave Account Manager. The card authorization is the gate. The Welcome Packet matters later, as the POA, when Client Services is ready to move the file to Awaiting Collections.

If the person should leave the pipeline instead (they cancelled, they are not interested, or the file should close), use **Cancel client** on their page. Those exits are not held up by the missing card form.
`,
  },
  {
    category: "Account Managers",
    title: "The Account Manager dashboard",
    sortOrder: 120,
    body: `Open **Dashboard**. If you are an Account Manager and not an admin, the page is about your own clients.

![The staff dashboard](/kb/dashboard.png)

Admins see a different dashboard. Theirs is described in **What admins see**. Yours has three counts:

- How many of your clients are in Account Manager.
- How many need a call. That means the file is marked ring no answer.
- How many appointments you have today.

## The three boxes

1. **My clients** is your Account Manager list. A row marked **Needs a call** has not answered. Click the name to open the file.
2. **Appointments** is this week. Click a day. The list under the days is that day only. **See all** opens the full Appointments page.
3. **Needs a call** repeats the ring-no-answer names so you can work them without hunting the table.

If every box says zero, you have no one in Account Manager assigned to you. That can be right on a quiet day. If you know you should have clients, ask an admin to check the assignment on the client and the Account Managers checkbox on **Team**.
`,
  },
  {
    category: "Account Managers",
    title: "Create a client",
    sortOrder: 130,
    body: `Only create a client when the person is actually starting. Do not make a practice file on the live list.

1. Click **Clients** in the sidebar.
2. Click **Add New Client** at the top right.

![The Clients page](/kb/clients.png)

3. Fill in the primary first and last name. Nickname is optional. If there is a spouse, use the secondary name fields. The spouse stays on this same file.
4. Enter email and a 10-digit mobile phone.
5. Enter the street, city, state, and ZIP. Start typing the street and pick the matching address if one appears.
6. Choose the **Account Manager**. The list is people marked as Account Managers on Team, plus every admin. If the list is empty, stop and ask an admin.
7. Choose the **MID**. This is required. The client keeps that MID. It decides which signature documents they are offered.
8. Enter the **verbal password**. This is the word the client will use when they call, so you know it is them.
9. Save. You land on the new client's page.

![The new client form](/kb/new-client.png)

The form will not save while a required box is empty. Read the red line under that box and fix it. You do not need to memorize which boxes are required. The page tells you.
`,
  },
  {
    category: "Account Managers",
    title: "Credit card authorization",
    sortOrder: 140,
    body: `A client in Account Manager cannot move to a later stage until a signed credit card authorization is on their Documents tab. There is no bypass.

The file counts if it was signed through e-sign, or if you uploaded the signed copy yourself. A missing card form used to be described as a warning only. That is no longer true. Do not follow any older note that says the Welcome Packet is what lets them leave Account Manager.

## What you do

1. Open the client.
2. If the top of the page says paperwork is missing before the next stage, click that notice. It opens Documents.
3. If you can see **E-Sign**, send the card authorization for that client's MID. Send is for clients in Account Manager or Client Services.
4. If you cannot see E-Sign, it is turned off. Uploads still work. Click **Upload +**, choose **CC Authorization**, and add the signed file.
5. After the file is listed under Documents, go back to the stage dropdown and move the client.

Clicking a name on the admin dashboard's **Missing CC Authorizations** list opens the upload box with CC Authorization already chosen.

Audio recordings never replace the card form. A note that says the client agreed on the phone is not enough.
`,
  },
  {
    category: "Account Managers",
    title: "Move a client out of Account Manager",
    sortOrder: 150,
    body: `The stage control is the dropdown near the client's name. The usual next stage is **Client Services**.

1. Confirm the credit card authorization is on Documents. If it is not, the change is blocked and the page tells you why.
2. Open **Settings** on the client, or click **Edit** next to Account Manager on the left. Assign a Client Services person before you hand the file off, so it does not sit with nobody.
3. Change the stage to Client Services.
4. If a box appears and will not let you continue, use the link in that box. It takes you to the missing document. Do not keep clicking the stage.

## When you are not moving them forward

**Cancel**, beside the stage dropdown, is the button for leaving the pipeline. Cancel and similar exits are not held for the card form. Use it only when the client is actually done, not when you are stuck on a document.

After the file is in Client Services, your Account Manager dashboard no longer treats it as your queue. Client Services picks it up from their own dashboard.
`,
  },
  {
    category: "Client Services",
    title: "Your day in Client Services",
    sortOrder: 210,
    body: `Client Services starts when the file arrives from Account Manager. The card authorization should already be on the file. Your gate is different.

1. Open **Dashboard** and see who is assigned to you.
2. Open each client. Read the notes and the Documents tab before you call.
3. Collect the signed POA. The signed Welcome Packet is stored as that POA.
4. Book follow-up appointments.
5. When the signed POA is on the file, you can move the stage to **Awaiting Collections**.

You cannot make that move with the POA missing. Uploading the POA is the way through. There is no checklist card on the client page anymore. Do not look for boxes named CS Intro or Tracking Update. Those were removed.

If a file has been in Client Services for a long time with no POA, it shows on your dashboard as overdue.
`,
  },
  {
    category: "Client Services",
    title: "The Client Services dashboard",
    sortOrder: 220,
    body: `Open **Dashboard**. If you are Client Services, and you are not also marked as an Account Manager, and you are not an admin, this page is yours.

The three counts are:

- How many clients in Client Services are assigned to you.
- How many are POA overdue. That means 21 days or more in Client Services with no signed POA.
- How many appointments you have today.

## The three boxes

1. **My clients** lists your files. The status says **POA signed**, **No POA**, or **POA overdue**. Click a row that is not signed. It opens Documents with the POA upload already chosen.
2. **Appointments** works the same way as the Account Manager calendar. Click a day. **See all** opens Appointments.
3. **POA follow-up** is the overdue list, so you can call those people first.

If you are in both departments, you will see the Account Manager dashboard instead. Use **Clients** and search to find your Client Services files, or ask an admin which dashboard you should be using.
`,
  },
  {
    category: "Client Services",
    title: "The signed POA",
    sortOrder: 230,
    body: `Awaiting Collections stays locked until a signed POA is on the client.

The signed copy counts when the POA file is on Documents, or when the signed date is already stored on the client. Sending the Welcome Packet for signature, and uploading a POA you already have, are both valid. A conversation is not.

## What you do

1. Open the client and click **Documents**.
2. If E-Sign is visible, send the document that belongs to this client's MID. Do not send another MID's file.
3. If E-Sign is hidden, click **Upload +**, choose **POA File**, and add the signed PDF.
4. Return to the stage dropdown and choose **Awaiting Collections**.

The client header can show a missing-paperwork notice. Click it. For a missing POA it opens the upload form with POA already selected.

The POA does not move the client by itself in every case. After it is on file, you still confirm the stage. Credit card authorization never moves the stage for you, and an audio file never does either.
`,
  },
  {
    category: "Working a client",
    title: "The client page",
    sortOrder: 310,
    body: `Click a name anywhere in the system. The client page is two parts.

![A client page](/kb/client.png)

## The left side

This column runs the full height of the page. From top to bottom:

1. The client's name. A nickname sits beside it in parentheses, the same way a spouse line does.
2. The spouse, if there is one.
3. Account Manager, Client Services, and Attorney. **Edit** on this row opens the **Settings** tab. It does not open a popup. That is where you change who is assigned.
4. Verbal password, email, phones, and address. **Edit** on the verbal password row is where you change contact details.
5. Created, and the last activity.

The MID is not repeated in this column. It is the menu on the right of the tabs, labeled like **MID · Golden Pathway**.

## The right side

The tabs are Overview, Documents, Drips, and Settings. The MID menu sits on that same bar on a computer. On a phone, the tabs come first and the MID menu is on the next line, so the tabs are not covered.

Use **Back to Clients** at the top when you are done. Do not use the browser back button if a box is still open. Close the box first.
`,
  },
  {
    category: "Working a client",
    title: "Overview, notes, and missing paperwork",
    sortOrder: 320,
    body: `**Overview** is the home tab on a client.

## Missing paperwork

If the next stage is blocked, a notice appears at the top of Overview. It is a link, not a progress bar. Click it.

- A missing credit card authorization opens Documents for that signature.
- A missing POA opens the upload form with POA already selected.

The notice is only on Overview. If you are on Documents, you will not see it. Go back to Overview.

## Notes

Notes are on Overview, under Appointments. The small icons log a call, text, email, or note. Those entries stack in this section, shortened until you click one, which opens the full message in place.

Do not put a card number in a note. Do not put a password other than the verbal password the form already stores.

## Activity log

The activity log is under that list, still on Overview. It is the history of what happened on the file, such as stage changes. There is no separate Activity tab.
`,
  },
  {
    category: "Working a client",
    title: "Documents and uploads",
    sortOrder: 330,
    body: `Open the client and click **Documents**.

![The Documents tab](/kb/documents.png)

This tab is the file cabinet. Uploads are always here. E-Sign may be hidden. Read **E-sign** if you do not see it.

## Upload a file

1. Click **Upload +**.
2. Choose the file type before you pick the file. The common ones are **CC Authorization**, **POA File**, **Collection Letter**, **Audio Recording**, and **Other**.
3. Choose the file from your computer. PDF, text, pictures, common audio, video, and Word files are accepted.
4. Notes are optional. They are for staff, not for the client.
5. Click **Upload** and wait until the file appears in the list.

Pick the real type. A card form uploaded as Other does not count as the credit card authorization, so the stage will stay blocked.

You can preview a file from the list. Attorneys who are allowed onto the file can download from their own portal. You do not email the file to yourself to "save a copy" unless an admin asks.

Older bookmarks that say packets or letters open this same Documents tab. There is no separate mail room.
`,
  },
  {
    category: "Working a client",
    title: "E-sign",
    sortOrder: 340,
    body: `E-sign sends a PDF for the client to sign on their own screen. Golden Pathway does not use a separate signature company. The documents live on the MID.

## If you do not see E-Sign

The E-Sign card on Documents stays off until **Show E-Sign** is turned on. That choice applies to every staff member, not just the person who clicked it. Uploads stay available the whole time. Signing links that were already sent still work. The **E-Sign Documents** page in the sidebar still works for admins.

If the card is hidden and you need a signature, upload the signed file, or ask an admin to show E-Sign.

## If you do see it

1. Confirm the MID on the tab bar. The documents offered are that MID's documents only.
2. Send while the client is in Account Manager or Client Services.
3. Read the preview before you send. Fix any box that landed in the wrong place. Card numbers, amounts, and dates the system could not read stay blank on purpose so a person fills them.
4. After the client signs, the finished file shows up on Documents. You do not download it from your email and upload it again.

Admins add a MID and its PDFs from **E-Sign Documents** in the sidebar. Open that MID and click **E-Sign documents** to upload the PDF and place the boxes. Adding the MID name does not place the boxes by itself.
`,
  },
  {
    category: "Working a client",
    title: "Appointments",
    sortOrder: 350,
    body: `An appointment is a scheduled call or meeting. It shows on your dashboard and on the Appointments page.

![The Appointments page](/kb/appointments.png)

## Add one

1. Click **Appointments** in the sidebar.
2. Click **Add Appointment** at the top right.
3. Choose the client, the date and time, and a short description of why you are calling. Enter the date and time in the client's time zone, from their state and ZIP. The appointment then shows that time, Arizona time, and the time on your own computer.
4. Save.

**Sales** and **Service** filter the list. **All Types** narrows it further. The two buttons on the right switch between the list and the calendar. Mark an appointment complete when the call happened. Delete it only if it was created by mistake.

Clicking a day on the dashboard calendar does not create an appointment. It only filters the list. Create the appointment from this page.

Appointments are assigned to a person. If you do not see one a coworker booked, it may be on their list rather than yours.
`,
  },
  {
    category: "Working a client",
    title: "Drips",
    sortOrder: 360,
    body: `**Drips** on a client are automatic emails. They are not text messages, and they are not paper mail.

1. Open the client.
2. Click **Drips**.
3. Read which sequence is active before you enroll the client in another one.
4. If the client should stop receiving a sequence, stop it there. Do not ignore it and hope it ends.

Admins edit the wording under **Settings**, then **Message Templates**.

If automatic emails are paused, the notice is on Message Templates. It is not on the dashboard. A paused sequence will not send, even if the client looks enrolled. Ask an admin before you promise a client that an email is on the way.
`,
  },
  {
    category: "Working a client",
    title: "Assignments and the MID",
    sortOrder: 370,
    body: `Who owns the file, and which MID it uses, are on the client.

## People

1. On the left, click **Edit** next to Account Manager. The Settings tab opens.
2. **Accounts** is the Account Manager. **Client Services** is the Client Services assignee. **Assigned Attorney** is the attorney.
3. Each menu is a short list with a search box. The row with the check is the current person.
4. Save.

You may only see the names, without menus. That means your login cannot reassign. Ask an admin.

There is no third department. Do not look for a compliance assignee.

The attorney line does not mean the attorney was emailed just because a letter was uploaded. Follow the Attorney Queue article if you are an admin handing a case off.

## MID

The MID menu is on the tab bar, to the right of Overview, Documents, Drips, and Settings. On a phone it is under the tabs.

1. Open the menu.
2. Choose **MID ·** and the name.
3. The page refreshes. The signature documents follow the new MID.

Do not change a MID to "clean up the list." It changes which documents the client is offered. Financial and signed records keep the MID name they had when they were created, so renaming a MID later does not rewrite old files.
`,
  },
  {
    category: "Working a client",
    title: "The Pipeline",
    sortOrder: 380,
    body: `**Pipeline** is the same clients you see in the list, one stage at a time, so you can see the pile at each step.

![The Pipeline, on the Sales view](/kb/pipeline.png)

1. Click **Pipeline**.
2. Choose **Sales** or **Service** at the top. Sales shows New Leads, Account Manager, and Retention. Service shows Client Services, Awaiting Collection Letter, and Case Sent to Attorneys.
3. Click the stage name. The number beside it is how many clients are in that stage.
4. Click a client's name to open the file. Change the stage on the client page, not from this list.

This page does not drag people between stages. If a move is not allowed, the client page explains what is missing.

Use Pipeline when you want to see volume. Use your dashboard when you want to see your own work for today.
`,
  },
  {
    category: "Working a client",
    title: "Cancel a client",
    sortOrder: 390,
    body: `Cancel means the client is leaving the active path. It is not how you pause a file for a day.

1. Open the client.
2. Click **Cancel**, beside the stage dropdown.
3. Read the confirmation before you accept it. This is hard to undo casually.
4. If the company owes a refund, an admin handles that from **Clients**, then **Refunds**. Account Managers and Client Services do not see the Refunds tab. They can still request the cancel. An admin marks the refund complete.

Closed and archived files stay in search. **Archives** on the Clients page is the list of inactive files. If you do not see **All Clients**, use Active, Archives, and the search button.

Do not delete a client to hide a mistake. Tell an admin.
`,
  },
  {
    category: "Admins",
    title: "What admins see",
    sortOrder: 410,
    body: `Admins do not get the Account Manager dashboard or the Client Services dashboard, even if those department boxes are checked. You get the leadership page. Admins still show up on both the Account Manager list and the Client Services list, so a file in either department can be assigned to an admin.

![The leadership dashboard](/kb/dashboard.png)

The three counts are:

- **Missing CC**, the active files in New Lead, Account Manager, or Client Services with no credit card authorization on file.
- **Clients Moved**, how many stage changes happened today.
- **Appointments Today**, open appointments for the whole office, not only yours.

**Missing CC Authorizations** is the work list. Click a name to upload the card form. **Appointments** is the office week. **Client Moved** is who changed stage today, and who moved them.

You also see Team, E-Sign Documents, Attorney Queue, Reports, and Refunds. Staff whose role says User do not.

On a client's Documents tab, **Show E-Sign** and **Hide** turn that card on or off for the whole company.
`,
  },
  {
    category: "Admins",
    title: "Team",
    sortOrder: 420,
    body: `**Team** is where people get access. Only an admin should be here.

1. Open **Team**.
2. Click **Invite Team Member** and use their work email. They set their own password from the invite. Do not share your password.
3. Set the role. Use Admin only for someone who should see reports, refunds, and the attorney queue. Use User for Account Managers and Client Services.
4. For a User, check **Account Managers**, **Client Services**, or both. That is their department. Admins are already in both lists.
5. Set **Direct line**. That number shows next to their name wherever they are the Account Manager or the Client Services person.
6. Save.

The assignee lists include people with the matching department checked, and every admin. An empty Account Manager list means nobody is checked and there is no admin, not that the form is broken.

Attorneys are a role of their own. They do not use the staff sidebar. After you create an attorney, they sign in and land on Cases.
`,
  },
  {
    category: "Admins",
    title: "MIDs and e-sign documents",
    sortOrder: 430,
    body: `A MID is a name plus the PDFs that belong to that name. There is no fixed list of document types in the software. You upload the files and place the boxes.

1. Click **E-Sign Documents** in the sidebar.
2. Add the MID by name if it is not there yet.
3. Open the MID and upload that MID's card authorization and Welcome Packet, or whatever PDFs that MID actually uses.
4. Click **E-Sign documents** on that MID. Upload the PDF and place the signature and text boxes. The editor can suggest the ordinary name, address, email, and phone boxes. Card number, expiration, amount, and payment date are not filled from the client file. A person places those.
5. A client only gets the documents for the MID on their tab bar.

![E-Sign Documents](/kb/esign.png)

Renaming a MID does not rewrite old signed files or old refunds. Those keep the name they had at the time.

Do not add a MID by putting a PDF in the software project. The upload on this page is the whole process.
`,
  },
  {
    category: "Admins",
    title: "Reports, Attorney Queue, and the attorney portal",
    sortOrder: 440,
    body: `These three are admin tools. Staff do not see them in the sidebar.

## Reports

**Reports** summarizes the book. Use it to answer "how many" questions. Use a client's page when you need to change something. A report is not where you upload a document.

## Attorney Queue

**Attorney Queue** is how a case is handed to an attorney in bulk. Assigning a name on the client Settings tab is the single-file version. The queue is the batch.

Uploading a collection letter does not, by itself, notify the attorney. Use the queue when the hand-off should reach them.

## What the attorney sees

Attorneys do not open Dashboard, Clients, or this Knowledge Base. Every other staff page sends them back to **Cases**.

On a case they can read the file, the notes, and the documents they are allowed to download. Their settings page is the other place they can stand. If an attorney says they cannot find the pipeline, that is expected. They are not missing a click.
`,
  },
  {
    category: "Admins",
    title: "Edit this Knowledge Base",
    sortOrder: 450,
    body: `Admins can change these articles. Everyone else can read them.

1. Open **Knowledge Base**.
2. Pick the section on the left, then the article.
3. Click **Edit** to change the title, the section, or the body. Click **New article** for a new one.
4. Save. The article is stored in the database. You do not need a software deploy to publish a wording fix.

## How the body is written

- A line that starts with **#** or **##** is a heading.
- A line that starts with **1.** is a step. Keep the steps in order.
- A line that starts with **-** is a bullet.
- Wrap a few words in double asterisks to make them **bold**.
- A picture is a line like this, and the file has to live in the site's kb pictures folder: **![What the picture shows](/kb/example.png)**

Use a short title. Put the article in the section that matches the reader. Account Managers should not have to open the admin section to learn their own job.

Delete an article only when it is wrong and a newer article replaces it. The old article that said a missing card authorization does not block a stage change has been removed on purpose. Do not put that sentence back.
`,
  },
];
