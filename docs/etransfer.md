# YORU Pro and donations by Interac e-Transfer

Payments go to **nextyoru@gmail.com** (Autodeposit, so senders need no security question).
Pro is **CAD $5.99 for one month per payment**; nothing renews by itself. Donations are
$2 to $500 and buy nothing.

## How a member pays (`/pro`)

1. **Pay by e-Transfer** (or **Donate** in "Support YORU") creates an order with:
   - an **exact amount** a few cents under the price, e.g. **$5.84** for Pro. No two waiting
     orders ever share an amount (a database rule), so the cents identify the person;
   - a **reference code** like `YORU-7K3QD` for the e-Transfer message.
2. They send it from their bank, optionally type the name on their bank account, and tap
   **I've sent it**. Unsent checkouts lapse after 7 days.
3. Pro switches on only when the owner confirms the payment. They get a notification.

## How the owner checks payments (Watchtower → Payments, owner only)

Each day, type in the **total that arrived by e-Transfer** that day and tap Save. YORU works
out which waiting payments that total is made of:

| Result | What it means | What to do |
| --- | --- | --- |
| **It matches** | every waiting payment is in the total | **Confirm all** |
| **N didn't arrive** | the total is exactly some of the payments; the rest are listed as **Didn't pay (no Pro yet)** | Confirm the paid ones; leave the rest waiting a day or tap **Not received** |
| **Can be made several ways** | different sets of people add up to the same total | Confirm the ones marked as definitely paid; check the reference codes of the "check" ones in your deposit emails |
| **Nothing adds up** | someone sent a different amount, or money came from outside a checkout | Match reference codes in your deposit emails and confirm one by one |

Things the maths can't do, and the app says so when they happen:

- If someone ignores the cents and sends the plain $5.99, the match still works when only one
  Pro order could be theirs. With several Pro orders waiting, a plain $5.99 could be anyone's,
  so those people are listed under "check the reference code".
- The total alone can't tell two people apart if their amounts add up the same way. That's
  why every payment also has a reference code and an optional bank name.

**Nothing is ever confirmed automatically.** A wrong confirmation can be undone (Recent
decisions → Undo): the Pro month it gave is removed and any later months move up.

## Rules the database enforces (tests: `tests/db/etransfer.test.ts`)

- Members see and act on their own orders only; the tables can't be read directly.
- Only the owner can confirm, reject, undo or enter deposits. Every action is in the audit log.
- Each Pro payment adds one month, after any Pro already running. Donations never give Pro.
- A batch confirmation is all or nothing.
- Deleting an account keeps its orders for the books but removes the account link and bank name.

The matching maths (`src/lib/billing/etransfer.ts`) is checked against a brute-force count of
every possible combination on 300 random days (`tests/unit/etransfer.test.ts`).

## Changing the email or price

They live in `public.etransfer_config()` (migration 0016) on purpose: changing where money
goes should take a migration, not one click.
