import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// Pro and donations by Interac e-Transfer (migration 0016): members can only
// touch their own orders, waiting orders never share an amount, only the owner
// confirms, Pro months stack and can be taken back.

let db: PGlite;
const root = path.resolve(__dirname, "../..");
const u: Record<string, string> = {};

type Order = {
  id: string; kind: string; base_cents: number; amount_cents: number; code: string; sender_name: string;
  status: string; matched_day: string | null; pro_until: string | null;
};

async function as<T>(who: string | null, sql: string, params: unknown[] = []): Promise<T> {
  return db.transaction(async (tx) => {
    if (who) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: who, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
    } else {
      await tx.exec("set local role anon");
    }
    return (await tx.query<{ r: T }>(sql, params)).rows[0].r;
  });
}
const start = (who: string, kind: string, cents?: number) =>
  as<Order>(who, "select public.etransfer_start($1, $2) as r", [kind, cents ?? null]);
const isPro = async (id: string) => (await db.query<{ r: boolean }>("select public.is_pro($1) as r", [id])).rows[0].r;
async function signup(name: string) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@etransfer.test`,
    JSON.stringify({ username: name, display_name: name }),
  ]);
  return r.rows[0].id;
}
const proRows = async (id: string) =>
  (
    await db.query<{ starts_at: string; ends_at: string; status: string }>(
      "select starts_at::text, ends_at::text, status from public.entitlements where user_id = $1 and source = 'etransfer' order by starts_at",
      [id],
    )
  ).rows;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  u.owner = await signup("et_owner"); // the first member becomes the owner
  u.amy = await signup("et_amy");
  u.ben = await signup("et_ben");
  u.cal = await signup("et_cal");
  const roles = await db.query<{ username: string; role: string }>("select username, role from public.profiles where username like 'et_%'");
  expect(roles.rows.find((r) => r.username === "et_owner")?.role).toBe("owner");
});

describe("e-Transfer checkout", () => {
  it("shows the settings to members only", async () => {
    const cfg = await as<{ email: string; pro_cents: number; currency: string }>(u.amy, "select public.etransfer_config() as r");
    expect(cfg).toMatchObject({ email: "nextyoru@gmail.com", pro_cents: 599, currency: "CAD" });
    await expect(as(null, "select public.etransfer_config() as r")).rejects.toThrow(/permission denied/);
  });

  it("gives each waiting order its own amount and a reference code", async () => {
    const a = await start(u.amy, "pro");
    expect(a).toMatchObject({ kind: "pro", base_cents: 599, amount_cents: 598, status: "open" });
    expect(a.code).toMatch(/^YORU-[A-HJ-NP-Z2-9]{5}$/);
    // asking again returns the same waiting Pro order
    expect((await start(u.amy, "pro")).id).toBe(a.id);
    const b = await start(u.ben, "pro");
    expect(b.amount_cents).toBe(597);
    expect(b.code).not.toBe(a.code);
  });

  it("checks donation amounts", async () => {
    await expect(start(u.cal, "donation", 150)).rejects.toThrow(/Donations can be from \$2 to \$500/);
    await expect(start(u.cal, "donation", 60000)).rejects.toThrow(/Donations can be from/);
    await expect(start(u.cal, "nope")).rejects.toThrow(/Choose Pro or a donation/);
    const d = await start(u.cal, "donation", 1000);
    expect(d).toMatchObject({ kind: "donation", base_cents: 1000, amount_cents: 999 });
  });

  it("limits each member to three waiting payments", async () => {
    await start(u.cal, "donation", 500);
    await start(u.cal, "donation", 500);
    await expect(start(u.cal, "donation", 500)).rejects.toThrow(/already have 3 payments waiting/);
  });

  it("never lets two waiting orders share an amount", async () => {
    const amounts = (await db.query<{ amount_cents: number }>("select amount_cents from public.etransfer_orders where status in ('open','sent')")).rows.map(
      (r) => r.amount_cents,
    );
    expect(new Set(amounts).size).toBe(amounts.length);
    const any = (await db.query<{ code: string; amount_cents: number }>("select code, amount_cents from public.etransfer_orders where status = 'open' limit 1")).rows[0];
    await expect(
      db.query("insert into public.etransfer_orders (kind, base_cents, amount_cents, code) values ('pro', 599, $1, 'YORU-ZZZZZ')", [any.amount_cents]),
    ).rejects.toThrow(/duplicate key/);
  });

  it("keeps members to their own orders", async () => {
    const mine = await as<Order[]>(u.amy, "select public.etransfer_my_orders() as r");
    expect(mine).toHaveLength(1);
    await expect(as(u.ben, "select public.etransfer_mark_sent($1, 'Ben') as r", [mine[0].id])).rejects.toThrow(/No such payment/);
    await expect(as(u.ben, "select public.etransfer_cancel($1) as r", [mine[0].id])).rejects.toThrow(/No such payment/);
    await expect(as(u.amy, "select count(*) as r from public.etransfer_orders")).rejects.toThrow(/permission denied/);
    await expect(as(u.amy, "select public.etransfer_admin_orders() as r")).rejects.toThrow(/Only the owner/);
    await expect(as(u.amy, "select public.etransfer_confirm(array[$1]::uuid[]) as r", [mine[0].id])).rejects.toThrow(/Only the owner/);
    await expect(as(u.amy, "select public.etransfer_set_day(current_date, 599) as r")).rejects.toThrow(/Only the owner/);
    expect(await isPro(u.amy)).toBe(false);
  });

  it("marks a payment as sent with the sender's name", async () => {
    const [a] = await as<Order[]>(u.amy, "select public.etransfer_my_orders() as r");
    const sent = await as<Order>(u.amy, "select public.etransfer_mark_sent($1, '  Amy Li  ') as r", [a.id]);
    expect(sent).toMatchObject({ status: "sent", sender_name: "Amy Li" });
    await expect(as(u.amy, "select public.etransfer_cancel($1) as r", [a.id])).rejects.toThrow(/haven't sent yet/);
  });
});

describe("Owner confirmation", () => {
  it("confirms a Pro payment: one month of Pro, a notice to the member", async () => {
    const [a] = await as<Order[]>(u.amy, "select public.etransfer_my_orders() as r");
    const out = await as<{ confirmed: number }>(u.owner, "select public.etransfer_confirm(array[$1]::uuid[], current_date) as r", [a.id]);
    expect(out.confirmed).toBe(1);
    expect(await isPro(u.amy)).toBe(true);
    const rows = await proRows(u.amy);
    expect(rows).toHaveLength(1);
    const days = (Date.parse(rows[0].ends_at) - Date.parse(rows[0].starts_at)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
    const note = await db.query<{ body: string }>("select body from public.notifications where user_id = $1 and kind = 'system' order by created_at desc limit 1", [u.amy]);
    expect(note.rows[0].body).toContain("YORU Pro is on");
    await expect(as(u.owner, "select public.etransfer_confirm(array[$1]::uuid[]) as r", [a.id])).rejects.toThrow(/already confirmed/);
  });

  it("stacks a second Pro payment after the first month", async () => {
    const b = await start(u.amy, "pro");
    expect(b.status).toBe("open");
    // the cents of a confirmed order are free again
    expect(b.amount_cents).toBe(598);
    await as(u.owner, "select public.etransfer_confirm(array[$1]::uuid[]) as r", [b.id]);
    const rows = await proRows(u.amy);
    expect(rows).toHaveLength(2);
    expect(rows[1].starts_at).toBe(rows[0].ends_at);
  });

  it("undoing the first month pulls the second one forward, with no gap", async () => {
    const orders = await as<Order[]>(u.amy, "select public.etransfer_my_orders() as r");
    const first = orders[orders.length - 1];
    await as(u.owner, "select public.etransfer_undo($1) as r", [first.id]);
    expect(await isPro(u.amy)).toBe(true);
    const active = (await proRows(u.amy)).filter((r) => r.status === "active");
    expect(active).toHaveLength(1);
    expect(Date.parse(active[0].starts_at)).toBeLessThanOrEqual(Date.now());
    const again = await as<Order[]>(u.amy, "select public.etransfer_my_orders() as r");
    expect(again.find((o) => o.id === first.id)?.status).toBe("sent");
  });

  it("a batch with a bad id changes nothing", async () => {
    const b = (await as<Order[]>(u.ben, "select public.etransfer_my_orders() as r"))[0];
    await expect(
      as(u.owner, "select public.etransfer_confirm(array[$1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]) as r", [b.id]),
    ).rejects.toThrow(/doesn't exist/);
    expect(await isPro(u.ben)).toBe(false);
    const still = (await as<Order[]>(u.ben, "select public.etransfer_my_orders() as r"))[0];
    expect(still.status).toBe("open");
  });

  it("a donation is recorded but gives no Pro", async () => {
    const d = (await as<Order[]>(u.cal, "select public.etransfer_my_orders() as r")).find((o) => o.base_cents === 1000)!;
    await as(u.owner, "select public.etransfer_confirm(array[$1]::uuid[], current_date) as r", [d.id]);
    expect(await isPro(u.cal)).toBe(false);
  });

  it("rejects a payment that never arrived, and can undo that too", async () => {
    const b = (await as<Order[]>(u.ben, "select public.etransfer_my_orders() as r"))[0];
    const r = await as<Order>(u.owner, "select public.etransfer_reject($1, 'Not in my deposits') as r", [b.id]);
    expect(r.status).toBe("rejected");
    expect(await isPro(u.ben)).toBe(false);
    const back = await as<Order>(u.owner, "select public.etransfer_undo($1) as r", [b.id]);
    expect(back.status).toBe("sent");
  });

  it("keeps a log of daily deposits next to what was confirmed for that day", async () => {
    await as(u.owner, "select public.etransfer_set_day(current_date, 1597) as r");
    await as(u.owner, "select public.etransfer_set_day(current_date, 1598, 'corrected') as r");
    const days = await as<{ day: string; total_cents: number; confirmed_cents: number; confirmed_count: number; note: string }[]>(
      u.owner,
      "select public.etransfer_days() as r",
    );
    expect(days[0]).toMatchObject({ total_cents: 1598, note: "corrected", confirmed_count: 1, confirmed_cents: 999 });
    await expect(as(u.owner, "select public.etransfer_set_day(current_date + 5, 100) as r")).rejects.toThrow(/up to today/);
    const audit = await db.query<{ n: number }>("select count(*)::int as n from public.audit_log where action like 'etransfer.%'");
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(6);
  });

  it("lets unsent checkouts lapse after a week", async () => {
    const c = await as<Order[]>(u.cal, "select public.etransfer_my_orders() as r");
    const open = c.filter((o) => o.status === "open");
    expect(open.length).toBe(2);
    await db.query("update public.etransfer_orders set created_at = now() - interval '8 days' where id = $1", [open[0].id]);
    await start(u.cal, "donation", 300); // any checkout tidies up first
    const after = await as<Order[]>(u.cal, "select public.etransfer_my_orders() as r");
    expect(after.find((o) => o.id === open[0].id)?.status).toBe("canceled");
  });

  it("the owner's list shows who is waiting and whether they have Pro", async () => {
    const list = await as<(Order & { user: { username: string }; is_pro: boolean })[]>(u.owner, "select public.etransfer_admin_orders() as r");
    const ben = list.find((o) => o.user?.username === "et_ben");
    expect(ben).toMatchObject({ status: "sent", is_pro: false });
    expect(list.some((o) => o.user?.username === "et_amy" && o.is_pro)).toBe(true);
  });

  it("deleting an account keeps the order for the books but forgets the bank name", async () => {
    const tmp = await signup("et_gone");
    const o = await start(tmp, "pro");
    await as(tmp, "select public.etransfer_mark_sent($1, 'Gone Person') as r", [o.id]);
    await db.query("delete from public.profiles where id = $1", [tmp]);
    const row = (await db.query<{ user_id: string | null; sender_name: string; code: string }>(
      "select user_id, sender_name, code from public.etransfer_orders where id = $1", [o.id])).rows[0];
    expect(row).toMatchObject({ user_id: null, sender_name: "", code: o.code });
  });
});
