// The printable LPS form "Rekod Kedatangan Pekerja", as plain HTML + CSS.
// One renderer serves both the admin website's print view and the phone app's PDF export,
// so the two always look identical.
import type { SessionUser } from "./auth";
import { getSettings, type Db } from "./db";
import { resolveRange } from "./admin-records";
import { HttpError } from "./http";
import { STAFF_COLUMNS, buildStaffDays, type StaffRow } from "./report";
import type { DayView } from "./rules";
import { MALAY_DAYS, addDays, dmy, fmtMalay, longDate, mondayOf, mytDate } from "./time";

export const DEFAULT_PRINT_TITLE = "Rekod Kedatangan Pekerja Lembaga Pengurusan Sekolah Tinggi Kota Kinabalu";

/** A4 landscape sheets, two weekly tables each. */
export const FORM_CSS = `
@page { size: A4 landscape; margin: 0; }
.sheet {
  width: 297mm; height: 210mm; margin: 0 auto; padding: 10mm 12mm 7mm; box-sizing: border-box;
  background: #fff; color: #111; display: flex; flex-direction: column; overflow: hidden;
  font-family: "Times New Roman", Tinos, "Liberation Serif", "Noto Serif", Times, serif;
  break-after: page; page-break-after: always;
}
.sheet:last-child { break-after: auto; page-break-after: auto; }
.sheet .weeks { flex: 1; display: flex; flex-direction: column; gap: 8mm; }
.week-title { margin: 0 0 2.2mm; text-align: center; font-size: 12.5pt; font-weight: 700; font-style: italic; letter-spacing: 0.01em; }
table.form { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.form th, table.form td { border: 0.6pt solid #4a4a4a; padding: 0 1.6mm; vertical-align: middle; }
table.form th { height: 7.2mm; font-size: 9.5pt; font-weight: 400; font-style: italic; text-align: center; }
table.form td { height: 9.6mm; font-size: 9.5pt; }
td.c-date, td.c-in, td.c-out { text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.c-day { text-align: center; font-style: italic; }
td.c-name { font-size: 9pt; line-height: 1.15; }
td.c-sig { text-align: center; padding: 0.4mm 1mm; }
td.c-sig img { display: inline-block; max-height: 8.4mm; max-width: 100%; object-fit: contain; }
td.c-note { font-size: 7.8pt; line-height: 1.15; }
td.c-note .clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
tr.out-of-range td.c-date { color: #9aa3ae; font-size: 8pt; }
.sheet-foot { display: flex; justify-content: space-between; margin-top: 3mm; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 6.8pt; color: #6b7280; }
`;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type PrintStaff = StaffRow & { signature: string | null };

export type PrintData = {
  from: string;
  to: string;
  title: string;
  orgName: string;
  withSig: boolean;
  staff: PrintStaff[];
  days: Map<number, Map<string, DayView>>;
  weekStarts: string[];
};

/**
 * Loads what the form needs. Staff can only print their own record; admins can pick
 * anyone (`staff=<id>`) or everyone (`staff=all`).
 */
export async function loadPrintData(db: Db, user: SessionUser, params: URLSearchParams): Promise<PrintData> {
  const { from, to } = resolveRange(params);
  const withSig = params.get("sig") === "1";
  const wanted = params.get("staff") ?? "me";
  const settings = await getSettings(db);
  const cols = `${STAFF_COLUMNS}, signature`;

  let staff: PrintStaff[];
  if (user.role === "admin" && wanted === "all") {
    staff = await db.query(
      `select ${cols} from staff s
        where active or exists (select 1 from attendance a where a.staff_id = s.id and a.work_date between $1 and $2)
        order by full_name`,
      [from, to],
    );
  } else {
    const id = user.role === "admin" && wanted !== "me" ? Number(wanted) : user.id;
    staff = await db.query(`select ${cols} from staff where id = $1`, [id]);
  }
  if (!staff.length) throw new HttpError(404, "Staff member not found.");

  const built = await buildStaffDays(db, staff, mondayOf(from), addDays(mondayOf(to), 6));
  const days = new Map<number, Map<string, DayView>>();
  for (const s of staff) days.set(s.id, new Map(built.get(s.id)!.days.map((d) => [d.date, d])));

  // Every week (Monday to Sunday) touching the period; days outside it stay blank.
  const weekStarts: string[] = [];
  for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) weekStarts.push(w);

  return {
    from,
    to,
    title: settings.print_title || DEFAULT_PRINT_TITLE,
    orgName: settings.org_name || "DAICOE",
    withSig,
    staff,
    days,
    weekStarts,
  };
}

export function periodLabel(d: Pick<PrintData, "from" | "to">) {
  return d.from === d.to ? longDate(d.from) : `${longDate(d.from)} to ${longDate(d.to)}`;
}

/**
 * The sheets as HTML. `signatureSrc` decides how a signature image is referenced:
 * a URL on the website, an inline data URL for the phone app's offline PDF.
 */
export function renderSheets(data: PrintData, signatureSrc: (s: PrintStaff) => string | null): { html: string; pages: number } {
  const printedAt = new Date();
  const printed = `${dmy(mytDate(printedAt))} ${fmtMalay(printedAt)}`;
  const parts: string[] = [];
  let pages = 0;
  for (const s of data.staff) {
    const total = Math.ceil(data.weekStarts.length / 2);
    const sig = data.withSig && s.signature ? signatureSrc(s) : null;
    const map = data.days.get(s.id)!;
    for (let i = 0; i < data.weekStarts.length; i += 2) {
      pages += 1;
      const weeks = data.weekStarts.slice(i, i + 2).map((w) => renderWeek(data, w, map, s.full_name, sig));
      parts.push(
        `<section class="sheet"><div class="weeks">${weeks.join("")}</div>` +
          `<footer class="sheet-foot"><span>${esc(s.full_name)} (${esc(s.staff_no)}). Dijana oleh MyAttendance, ${esc(data.orgName)}.</span>` +
          `<span>Dicetak ${printed}. Halaman ${i / 2 + 1}/${total}</span></footer></section>`,
      );
    }
  }
  return { html: parts.join(""), pages };
}

function renderWeek(data: PrintData, monday: string, map: Map<string, DayView>, name: string, sig: string | null) {
  const rows = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const day = map.get(date);
    const inRange = date >= data.from && date <= data.to;
    if (!inRange || !day) {
      return `<tr class="out-of-range"><td class="c-date">${dmy(date)}</td><td class="c-day">${MALAY_DAYS[i]}</td><td class="c-name"></td><td class="c-in"></td><td class="c-out"></td><td class="c-sig"></td><td class="c-note"></td></tr>`;
    }
    const personal = !!day.record || day.status === "leave" || day.status === "absent";
    const signed = !!day.clockIn && !!sig;
    return (
      `<tr><td class="c-date">${dmy(date)}</td><td class="c-day">${MALAY_DAYS[i]}</td>` +
      `<td class="c-name">${personal ? esc(name) : ""}</td>` +
      `<td class="c-in">${day.clockIn ? fmtMalay(new Date(day.clockIn)) : ""}</td>` +
      `<td class="c-out">${day.clockOut ? fmtMalay(new Date(day.clockOut)) : ""}</td>` +
      `<td class="c-sig">${signed ? `<img src="${esc(sig!)}" alt="">` : ""}</td>` +
      `<td class="c-note"><span class="clamp">${esc(day.remarkMs)}</span></td></tr>`
    );
  }).join("");
  return (
    `<div><h2 class="week-title">${esc(data.title)}</h2><table class="form">` +
    `<colgroup><col style="width:11.5%"><col style="width:7%"><col style="width:20%"><col style="width:14.5%"><col style="width:14.5%"><col style="width:11.5%"><col style="width:21%"></colgroup>` +
    `<thead><tr><th>Tarikh</th><th>Hari</th><th>Nama Pekerja</th><th>Masa Datang</th><th>Masa Balik</th><th>T. Tangan</th><th>Perkara Khas</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div>`
  );
}

/** A complete, self-contained HTML document (used for the phone app's PDF). */
export function renderDocument(data: PrintData, sheetsHtml: string) {
  return (
    `<!doctype html><html lang="ms"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(data.title)}</title><style>html,body{margin:0;padding:0;background:#fff}${FORM_CSS}</style></head>` +
    `<body>${sheetsHtml}</body></html>`
  );
}
