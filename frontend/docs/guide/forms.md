# Forms

Forms collect structured data and usually start an approval workflow. This guide walks through create → build → publish → fill → review → share.

::: tip Who can build forms
Only the **Administrator** (`Admin`) with a builder seat designs forms. Leaders and employees can **fill** published forms they’re allowed to use.
:::

## Form status (know this first)

| Status | Meaning |
| --- | --- |
| **Draft** | Being built; not for general fill |
| **Published** | Live — can be filled, shared, linked to a workflow |
| **Archived** | Retired; hidden from the fill list |

Only **published** forms can be filled or shared publicly.

## Step 1 — Open Forms

1. In the left sidebar, click **Forms**.

   ![Forms list](/screenshots/guide/forms-list.png)

2. Browse existing forms, or continue to create one.

**You should see:** your organization’s form list with status and actions.

## Step 2 — Create a form

1. Click **New** (or **Forms → New**).

   ![New form options](/screenshots/guide/forms-new.png)

2. Choose how to start:
   - **From a template** — ready-made fields (Leave, Purchase, Expense, …).
   - **Build with AI** — describe the form in plain English (needs LLM configured).
   - **Blank** — empty canvas.
   - **Default** — sample “Leave Request” with six fields.

**You should see:** the form builder with a title and field palette.

## Step 3 — Build fields

1. From the left palette, drag a field type onto the canvas (or click to add).

   ![Form builder](/screenshots/guide/forms-builder.png)

2. Click a field to set:
   - **Label**, help text / placeholder
   - **Required**
   - Type options (dropdown options, min/max, file size, grid columns)
   - Optional **validation** and **conditional logic** (below)
3. Reorder with the drag handle or **Up / Down**. Use **Duplicate** to clone a field.

### Field types (9)

| Field | Key options |
| --- | --- |
| **Text input** | multiline, placeholder, max length |
| **Number** | min, max |
| **Dropdown** | options |
| **Radio group** | options |
| **Date picker** | — |
| **File upload** | allowed types, max MB (1–50) |
| **Checkbox** | — |
| **Signature** | typed name or image |
| **Table / Grid** | typed columns; users add/remove rows |

### Validation (optional)

- **Text** — min/max length, regex (presets: email, phone, digits, alnum, custom).
- **Number** — min/max value.
- **File** — max size (public uploads also capped at 25 MB).

### Conditional logic (optional)

1. Select a field.
2. Set **Depends on** an *earlier* field.
3. Choose operator (equals, not equal, contains, non-empty) and value.
4. The field shows/hides live while filling. Hidden values are **stripped** on submit.

::: warning One rule per field
Use a single show/hide rule per field. Chain rules across fields for more complex behavior.
:::

**You should see:** a sensible order of fields with required marks where needed.

## Step 4 — Publish

1. Save your draft as you go.
2. Click **Publish** when the form is ready.

**You should see:** status **Published**. Only then can people fill it or can you link a workflow.

## Step 5 — Fill and submit (test as a user)

1. From the forms list, open **Fill** on a published form (or use the fill route).

   ![Fill form](/screenshots/guide/forms-fill.png)

2. Complete the fields. Name/email/department-like fields may **prefill**.
3. Optional: **Save draft** (no validation; one draft per person per form).
4. Click **Submit**.

**You should see:** confirmation. If a published workflow is linked with an automatic trigger, an approval run starts and you get links to your requests.

::: tip Drafts vs submissions
Drafts never appear in Responses and never start a workflow. Submit does both (when a workflow is linked).
:::

## Step 6 — View responses (builders)

1. On the forms list, open **Responses**.

   ![Form responses](/screenshots/guide/forms-responses.png)

2. Review submitter, time, source (**Internal** / **Public**), and field values.
3. Click **Export CSV** when you need a download (disabled if empty).

**You should see:** one row per submission; files as links, checkboxes as Yes/No.

## Step 7 — Share a public link (optional)

**Goal:** Let people without a NetFlow account submit.

1. On the forms list, click **Share** on a **published** form.

   ![Share public link](/screenshots/guide/forms-share.png)

2. Enable the public link and **Copy** it (`/f/<token>`).
3. Send the link. Use **Stop** to disable later (re-enable restores the same token).

**You should see:** submissions with source **Public**. Public submits are rate-limited and **do not** start workflows.

## Templates & AI (builders)

- **Templates:** Leave Approval, Purchase Request, Expense Reimbursement, Travel Request, IT Support, Onboarding, Document Submission, Vendor Registration, Performance Review, Asset Request, Customer Feedback, Incident Report.
- **AI draft:** describe the form → get title + fields to edit.
- **AI suggest:** ghost-text in the prompt; **Tab** / **→** to accept.

## Related

- Connect approvals in **Workflows**.
