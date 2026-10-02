# Onboarding & packet policy (Jul 2026)

Human-readable reference for compliance, accounts, and engineering. Cursor
agents load `.cursor/rules/onboarding-compliance-gates.mdc` when editing related
code.

## Audio recordings

| | |
|---|---|
| **Upload** | Yes — Documents tab, type "Audio Recording" (compliance snippets) |
| **Blocks packet send?** | **No** |
| **Blocks stage advance?** | **No** |

Bank compliance is satisfied via the **CC Authorization** form, not call
recordings.

## CC authorization

| | |
|---|---|
| **Upload** | Yes — Documents tab, type "CC Authorization" |
| **Blocks packet send?** | **No** |
| **Tracking** | Dev dashboard only — "Missing CC Authorization" widget (informational) |

## Signed POA

| | |
|---|---|
| **When required** | Leaving **Client Services** for **Awaiting Collection Letter** |
| **Not required at** | Account Manager / welcome packet stage |
| **Auto-advance** | Uploading signed POA while in Client Services advances stage |

## FedEx / packets (see also Packet Manager rule)

- **Secondary packet:** requires **spouse last name** on the client record
  (`hasSecondaryPacketLastName()` — first name alone is not enough).
- **PDF generator:** receives account manager **first name only**
  (`advisorFirstNameForPdf()`). Shipment history in Packet Manager still shows
  full advisor name.

## Changelog

- **Jul 2026:** Removed audio recording as advance gate; added dev-only CC auth
  tracker; POA gate confirmed at Client Services → Awaiting Collection Letter;
  secondary last name + PDF first-name rules documented.
