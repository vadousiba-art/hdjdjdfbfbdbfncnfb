// Writes the Pro catalog rows into migration 0009 (between the markers).
import fs from "node:fs";
import path from "node:path";
import { BEGIN, END, MEMBER_BEGIN, MEMBER_END, STAFF_BEGIN, STAFF_END, catalogSql, memberStaffSql, staffSql } from "../src/lib/pro/catalog-sql";

function write(name: string, begin: string, end: string, body: string) {
  const file = path.resolve(import.meta.dirname, "../supabase/migrations", name);
  const sql = fs.readFileSync(file, "utf8");
  const a = sql.indexOf(begin);
  const b = sql.indexOf(end);
  if (a < 0 || b < a) throw new Error(`catalog markers not found in ${name}`);
  fs.writeFileSync(file, sql.slice(0, a + begin.length) + "\n" + body + "\n" + sql.slice(b));
}
write("0009_pro_universe.sql", BEGIN, END, catalogSql());
write("0010_staff_cosmetics.sql", STAFF_BEGIN, STAFF_END, staffSql());
write("0012_cofounder_cosmetics.sql", MEMBER_BEGIN, MEMBER_END, memberStaffSql());
console.log("catalog written");
