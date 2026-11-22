// The review beside each blueprint (spec 010, FR-024c, FR-025, contracts/review.md): the hash of the blueprint it saw,
// the last lock over the real game and Vinicius's answer in the gallery, with the earlier answers.
import { format } from "prettier";
import { expect, test } from "vitest";
import {
  blueprintSha,
  parseReview,
  reviewJson,
  saoPauloTime,
  withLock,
  withVerdict,
} from "./review.ts";
import type { Review } from "./review.ts";

const BP = {
  id: "invented-number",
  root: { name: "Invented", ref: { call: "Invented", args: [0] } },
};
const SHA = blueprintSha(BP);
const LOCK = {
  ok: true,
  gameSha: "a".repeat(64),
  at: "2026-11-25T14:02:00-03:00",
};

test("the same blueprint reformatted has the same hash; a changed name has another", () => {
  const same = JSON.parse(
    `{ "root": { "ref": { "args": [0], "call": "Invented" },\n "name": "Invented" }, "id": "invented-number" }`,
  ) as unknown;
  expect(blueprintSha(same)).toBe(SHA);
  expect(SHA).toMatch(/^[0-9a-f]{64}$/);
  expect(
    blueprintSha({ ...BP, root: { ...BP.root, name: "Invented Two" } }),
  ).not.toBe(SHA);
});

test("a new answer pushes the earlier one to the history, with the hash it saw", () => {
  const first = withVerdict(
    withLock(null, SHA, LOCK),
    "fix",
    "rename the pool",
    SHA,
    "2026-11-25T15:00:00-03:00",
  );
  expect(first).toMatchObject({
    verdict: "fix",
    note: "rename the pool",
    lock: LOCK,
    history: [],
  });
  const second = withVerdict(
    first,
    "approved",
    null,
    SHA,
    "2026-11-25T16:00:00-03:00",
  );
  expect(second).toMatchObject({ verdict: "approved", note: null, lock: LOCK });
  expect(second.history).toEqual([
    {
      at: "2026-11-25T16:00:00-03:00",
      verdict: "fix",
      note: "rename the pool",
      blueprintSha: SHA,
    },
  ]);
});

test("a hash change clears the lock and the answer for the current blueprint, and keeps the earlier answer", () => {
  const approved = withVerdict(
    withLock(null, SHA, LOCK),
    "approved",
    null,
    SHA,
    LOCK.at,
  );
  const other = "b".repeat(64);
  const changed = withLock(approved, other, null);
  expect(changed).toMatchObject({
    blueprintSha: other,
    lock: null,
    verdict: null,
    note: null,
  });
  expect(changed.history.map((h) => [h.verdict, h.blueprintSha])).toEqual([
    ["approved", SHA],
  ]);
  // the same hash keeps the answer and takes the new lock
  const relocked = withLock(approved, SHA, { ...LOCK, ok: false });
  expect(relocked).toMatchObject({ verdict: "approved", lock: { ok: false } });
});

test("a note only with fix, up to 2,000 characters", () => {
  const base = withLock(null, SHA, LOCK);
  expect(() => withVerdict(base, "approved", "a note", SHA, LOCK.at)).toThrow();
  expect(() => withVerdict(base, "fix", null, SHA, LOCK.at)).toThrow();
  expect(() =>
    withVerdict(base, "fix", "x".repeat(2001), SHA, LOCK.at),
  ).toThrow();
  const ok = withVerdict(base, "fix", "x".repeat(2000), SHA, LOCK.at);
  expect(parseReview(JSON.parse(reviewJson(ok)))).toEqual(ok);
  expect(parseReview({ ...ok, verdict: "approved" })).toBe(null);
  expect(parseReview({ ...ok, note: "x".repeat(2001) })).toBe(null);
  // fix needs a note on load too, as withVerdict asks, and in the history
  expect(parseReview({ ...ok, note: null })).toBe(null);
  const entry = { at: LOCK.at, verdict: "fix", note: null, blueprintSha: SHA };
  expect(parseReview({ ...ok, history: [entry] })).toBe(null);
});

test("parseReview takes only the contract's shape", () => {
  const r: Review = withLock(null, SHA, LOCK);
  expect(parseReview(r)).toEqual(r);
  expect(parseReview({ ...r, version: 2 })).toBe(null);
  expect(parseReview({ ...r, blueprintSha: "short" })).toBe(null);
  expect(parseReview({ ...r, reason: "missing source" })).toBe(null);
  expect(parseReview({ ...r, lock: { ...LOCK, value: 3 } })).toBe(null);
  expect(parseReview({ ...r, verdict: "maybe" })).toBe(null);
  expect(parseReview({ ...r, history: [{ at: LOCK.at }] })).toBe(null);
  expect(parseReview(null)).toBe(null);
});

test("the time is in America/Sao_Paulo", () => {
  expect(saoPauloTime(new Date("2026-11-25T17:02:09.500Z"))).toBe(
    "2026-11-25T14:02:09-03:00",
  );
  expect(saoPauloTime(new Date("2027-01-01T02:00:00Z"))).toBe(
    "2026-12-31T23:00:00-03:00",
  );
});

test("reviewJson comes out as prettier would leave it", async () => {
  const full = withVerdict(
    withVerdict(withLock(null, SHA, LOCK), "fix", "a note", SHA, LOCK.at),
    "approved",
    null,
    SHA,
    LOCK.at,
  );
  for (const r of [withLock(null, SHA, null), full]) {
    const json = reviewJson(r);
    expect(await format(json, { parser: "json" })).toBe(json);
  }
});
