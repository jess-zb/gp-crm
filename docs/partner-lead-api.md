# Send a lead to Golden Pathway

This is the only access a partner CRM gets. It creates a lead. It does not read or change anything else.

## Endpoint

```
POST https://goldenpathway.vercel.app/api/leads
```

## Authentication

Send the API key Golden Pathway gave you on every request. Use either header:

```
Authorization: Bearer YOUR_API_KEY
```

or

```
X-Api-Key: YOUR_API_KEY
```

Keep the key on your server. Do not put it in a browser app, a mobile app, or a public repository. A missing or wrong key is rejected.

## Send the text export

This is the request to use. Post the same `.txt` file your software downloads. Name the file with the client name, for example `GLORIA WEAVER.txt`.

Every file creates a new lead. Sending the same name or phone again creates another lead. Golden Pathway does not look up or update an existing client.

Golden Pathway copies first name, last name, mobile phone, a second phone when it is different, street, city, state, ZIP, and email. Names, street, and city are stored in Title Case, the state as two letters, and the email in lowercase. The original file is saved under Documents, categorized as Enrolled Cards, with a Title Case file name such as `Gloria Weaver.txt`.

`Content-Type: text/plain`

```bash
curl -X POST https://goldenpathway.vercel.app/api/leads \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: text/plain" \
  -H "X-File-Name: JANE DOE.txt" \
  --data-binary @JANE\ DOE.txt
```

Or send the file as multipart form data:

```bash
curl -X POST https://goldenpathway.vercel.app/api/leads \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@JANE DOE.txt"
```

A JSON body with a `text` field is also accepted: `{ "text": "<file contents>", "file_name": "JANE DOE.txt" }`.

Created (`201`). Save `id` if you want a receipt for that send:

```json
{ "ok": true, "created": true, "id": "uuid", "document_id": "uuid" }
```

The file must include these lines, each as `Label : value`:

- `First name`
- `Last name`
- `Phone`
- `Street name`
- `City`
- `State`
- `Zip`
- `Email`

`Secondary Phones` is optional. A number that matches `Phone` is ignored. A different number is saved as the second phone.

## JSON fields

`Content-Type: application/json`

| Field | Required | Notes |
| --- | --- | --- |
| `first_name` | Yes | |
| `last_name` | Yes | |
| `phone` | Yes | 10-digit US number. Formatting and a leading `1` are fine. |
| `street_address` | Yes | |
| `city` | Yes | |
| `state` | Yes | Two letters (`FL`) or the full name (`Florida`). |
| `zip` | Yes | 5 digits, or 9 digits for ZIP+4. |
| `email` | No | Stored when present. |
| `source` | No | Short label for your system, up to 80 characters. Defaults to `Partner API`. |

`firstName`, `lastName`, `phoneNumber`, `streetAddress`, `zipCode`, and `postal_code` are accepted as aliases.

### Example

```bash
curl -X POST https://goldenpathway.vercel.app/api/leads \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "5551234567",
    "street_address": "123 Main St",
    "city": "Miami",
    "state": "FL",
    "zip": "33101"
  }'
```

## Responses

Created (`201`):

```json
{ "ok": true, "created": true, "id": "uuid" }
```

Each request creates a new lead, including when the phone was sent before.

Invalid body (`400`):

```json
{
  "ok": false,
  "error": "Invalid lead.",
  "fields": { "phone": "Phone must be a 10-digit US number." }
}
```

Wrong or missing key (`401`):

```json
{ "ok": false, "error": "Unauthorized." }
```

Save `id` if you want a receipt for that send.
