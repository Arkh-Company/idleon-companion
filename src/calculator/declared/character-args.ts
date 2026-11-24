// The arguments of a block's call the game gives from the character's index (spec 010, research R5; Fase 4 r1): the
// game passes the current character as `GetPlayersUsernames.indexOf(UserInfo[0])` (N.js: its Divinity("Bonus_Minor",
// …, god) in TotalStats, SkillStats, RunCodeOfTypeXforThingY and others). Found by the code at the call's place, in
// the caller's function text (instrument.ts Op.fnText), never by a number equal to the character's index; through a
// variable or a parameter the caller's own call got from the character (r2: Divinity("DivMinorBonus", t, 1)), by the
// one walk of save-args.ts. An argument some call of the caller gives from the character and another does not, the
// place does not decide: none. Here, the code's syntax tree and the character's own form.

export type AnyNode = { type: string; range: [number, number] } & Record<
  string,
  unknown
>;

export const isNode = (v: unknown): v is AnyNode =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { type?: unknown }).type === "string";
export const at = (n: AnyNode, k: string) => n[k] as AnyNode;

export function walk(n: AnyNode, out: AnyNode[] = []): AnyNode[] {
  out.push(n);
  for (const v of Object.values(n))
    for (const c of Array.isArray(v) ? (v as unknown[]) : [v])
      if (isNode(c)) walk(c, out);
  return out;
}

export const member = (n: AnyNode | undefined): string | undefined =>
  n?.type === "MemberExpression" && !n.computed
    ? (at(n, "property").name as string)
    : undefined;

/** `GetPlayersUsernames.indexOf(UserInfo[0])`, bare or through `asNumber(…)`; a variable or a parameter, save-args.ts follows. */
export function isCharacter(e: AnyNode | undefined, text: string): boolean {
  if (e?.type !== "CallExpression") return false;
  const callee = at(e, "callee");
  const [arg] = e.arguments as AnyNode[];
  if (member(callee) === "asNumber") return isCharacter(arg, text);
  const src = (n: AnyNode) => text.slice(...n.range);
  return (
    member(callee) === "indexOf" &&
    src(at(callee, "object")).includes("GetPlayersUsernames") &&
    arg?.type === "MemberExpression" &&
    arg.computed === true &&
    at(arg, "property").value === 0 &&
    src(at(arg, "object")).includes("UserInfo")
  );
}
