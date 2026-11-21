// The review beside each blueprint (spec 010, FR-024c, FR-025, contracts/review.md): the hash of the blueprint it saw,
// the last lock over the real game (written by `just trees`) and Vinicius's answer in the gallery (`just gallery`).
// The app never imports it: only the real-trees run, the gallery and the tests read it.
import { createHash } from "node:crypto";

export type Verdict = "approved" | "fix";
export interface ReviewEntry {
  /** When the answer left the current place: a newer answer, or a changed blueprint. */
  at: string;
  verdict: Verdict;
  note: string | null;
  blueprintSha: string;
}
export interface Review {
  version: 1;
  blueprintSha: string;
  lock: { ok: boolean; gameSha: string; at: string } | null;
  verdict: Verdict | null;
  note: string | null;
  history: ReviewEntry[];
}

export const NOTE_MAX = 2000;
const SHA = /^[0-9a-f]{64}$/;

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const only = (o: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(o).every((k) => keys.includes(k)) && keys.every((k) => k in o);
const isVerdict = (v: unknown): v is Verdict => v === "approved" || v === "fix";
/** A note only with fix, up to NOTE_MAX characters. */
const noteFits = (verdict: unknown, note: unknown) =>
  note === null ||
  (verdict === "fix" && typeof note === "string" && note.length <= NOTE_MAX);

function isEntry(x: unknown): x is ReviewEntry {
  return (
    isObj(x) &&
    only(x, ["at", "verdict", "note", "blueprintSha"]) &&
    typeof x.at === "string" &&
    isVerdict(x.verdict) &&
    noteFits(x.verdict, x.note) &&
    typeof x.blueprintSha === "string" &&
    SHA.test(x.blueprintSha)
  );
}

export function parseReview(raw: unknown): Review | null {
  if (
    !isObj(raw) ||
    !only(raw, [
      "version",
      "blueprintSha",
      "lock",
      "verdict",
      "note",
      "history",
    ])
  )
    return null;
  const { lock } = raw;
  const lockOk =
    lock === null ||
    (isObj(lock) &&
      only(lock, ["ok", "gameSha", "at"]) &&
      typeof lock.ok === "boolean" &&
      typeof lock.gameSha === "string" &&
      SHA.test(lock.gameSha) &&
      typeof lock.at === "string");
  const ok =
    raw.version === 1 &&
    typeof raw.blueprintSha === "string" &&
    SHA.test(raw.blueprintSha) &&
    lockOk &&
    (raw.verdict === null || isVerdict(raw.verdict)) &&
    noteFits(raw.verdict, raw.note) &&
    Array.isArray(raw.history) &&
    raw.history.every(isEntry);
  return ok ? (raw as unknown as Review) : null;
}

const canonical = (x: unknown): unknown =>
  Array.isArray(x)
    ? x.map(canonical)
    : isObj(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canonical(x[k])]),
        )
      : x;

/** sha256 of the blueprint in canonical form: keys in order, no spaces. */
export const blueprintSha = (raw: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify(canonical(raw)))
    .digest("hex");

const fresh = (sha: string, history: ReviewEntry[]): Review => ({
  version: 1,
  blueprintSha: sha,
  lock: null,
  verdict: null,
  note: null,
  history,
});
const pushed = (prev: Review, at: string): ReviewEntry[] =>
  prev.verdict === null
    ? prev.history
    : [
        ...prev.history,
        {
          at,
          verdict: prev.verdict,
          note: prev.note,
          blueprintSha: prev.blueprintSha,
        },
      ];

/** The real-trees run's lock. A changed blueprint starts over: no lock, no answer; the earlier answer goes to the history. */
export function withLock(
  prev: Review | null,
  sha: string,
  lock: Review["lock"],
): Review {
  if (prev && prev.blueprintSha === sha) return { ...prev, lock };
  const history = prev
    ? pushed(prev, lock?.at ?? saoPauloTime(new Date()))
    : [];
  return { ...fresh(sha, history), lock };
}

/** The gallery's answer; the earlier answer goes to the history with the hash it saw. */
export function withVerdict(
  prev: Review,
  verdict: Verdict,
  note: string | null,
  sha: string,
  at: string,
): Review {
  if (
    !isVerdict(verdict) ||
    (verdict === "fix" && note === null) ||
    !noteFits(verdict, note)
  )
    throw new RangeError(
      "a note only with fix, up to 2,000 characters; fix needs one",
    );
  const lock = prev.blueprintSha === sha ? prev.lock : null;
  return { ...fresh(sha, pushed(prev, at)), lock, verdict, note };
}

/** The file's text, as prettier leaves it, so `just fmt-check` never flags what the tools write. */
export const reviewJson = (r: Review): string =>
  `${JSON.stringify(r, null, 2)}\n`;

const ZONE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** `2026-11-25T14:02:00-03:00`: the time in America/Sao_Paulo, with its offset. */
export function saoPauloTime(d: Date): string {
  const p = Object.fromEntries(
    ZONE.formatToParts(d).map((x) => [x.type, x.value]),
  );
  const local = `${p.year ?? ""}-${p.month ?? ""}-${p.day ?? ""}T${p.hour ?? ""}:${p.minute ?? ""}:${p.second ?? ""}`;
  const minutes = Math.round(
    (Date.parse(`${local}Z`) - Math.floor(d.getTime() / 1000) * 1000) / 60_000,
  );
  const abs = Math.abs(minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local}${minutes < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
