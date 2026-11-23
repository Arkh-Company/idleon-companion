// The recipe pieces on load (spec 010, T169, T170; spec, Open Questions 23/11): a part several blueprints share is a
// piece written once, with params, called by a node with `piece: { name, args }` in place of its children. The load
// fills the args in and checks the piece's nodes as any node, with the ref checks on every path; it refuses a param
// missing or extra, a piece that does not exist and a piece that calls itself. The pieces here are invented.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { loadBlueprints } from "./blueprints.ts";

type Raw = Record<string, unknown>;
const SIGNS = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      "..",
      "fixtures",
      "blueprints",
      "invented-signs.piece.json",
    ),
    "utf8",
  ),
) as Raw & { children: Raw[] };

const line = (piece: unknown, extra: Raw = {}): Raw => ({
  key: "signs",
  name: "Invented Signs",
  ref: { call: "TreeSigns", args: ["Drop"] },
  piece,
  ...extra,
});
const drop = { name: "invented-signs", args: { stat: "Drop" } };
const blueprint = (source: Raw): Raw => ({
  id: "invented-signs-number",
  root: { name: "Invented", ref: { call: "TreeSignsRoot", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        { system: "cards", sources: [source] },
        {
          system: "stamps",
          sources: [
            {
              key: "capped",
              name: "Invented Capped",
              ref: { read: "TreeCapped" },
              leaf: "rawBonus",
            },
          ],
        },
      ],
    },
  ],
});
const parse = (source: Raw, pieces: Record<string, unknown> = {}) =>
  parseBlueprint(blueprint(source), {
    fileId: "invented-signs-number",
    systemIds: new Set(["cards", "stamps"]),
    pieces: new Map(Object.entries({ "invented-signs": SIGNS, ...pieces })),
  });
const reason = (source: Raw, pieces: Record<string, unknown> = {}) => {
  const out = parse(source, pieces);
  return out.ok ? "loaded" : out.reason;
};
/** A piece's model child, the first. */
function model(p: { children: Raw[] }): Raw {
  const [m] = p.children;
  if (!m) throw new Error("no model child");
  return m;
}
/** The invented piece with `change` made to a deep copy of it. */
const signsWith = (change: (p: Raw & { children: Raw[] }) => void) => {
  const p = structuredClone(SIGNS);
  change(p);
  return p;
};

test("a node that calls a piece loads with the piece's children, its params filled in by the args", () => {
  const out = parse(line(drop));
  if (!out.ok) throw new Error(out.reason);
  expect(out.stage).toBe("complete");
  const source = out.blueprint.pools[0]?.groups[0]?.sources[0];
  expect(source).toMatchObject({
    key: "signs",
    ref: { call: "TreeSigns", args: ["Drop"] },
    combine: "sum",
    each: { list: "TreeSigns[*]", as: "sign" },
  });
  // the item's name stays: each item of the recorded list fills it in (lock-pieces.ts)
  expect(source?.children).toEqual<BlueprintNode[]>([
    {
      key: "sign",
      name: "Invented Sign",
      nameProof: { table: "InventedSigns", row: "{sign}" },
      ref: { call: "TreeSign", args: ["Drop", "{sign}"] },
      combine: "product",
      children: [
        {
          key: "bonus",
          name: "Invented Sign Bonus",
          ref: { read: "TreeSignBonus.Drop[{sign}]" },
          leaf: "fixedValue",
        },
        {
          key: "multi",
          name: "Invented Sign Multi",
          ref: { read: "TreeSignMulti" },
          leaf: "rawBonus",
        },
      ],
    },
  ]);
  // a numeric arg goes in as a number where the whole value is the param, and as text inside a path
  const hp = parse(line({ name: "invented-signs", args: { stat: 7 } }));
  if (!hp.ok) throw new Error(hp.reason);
  expect(
    hp.blueprint.pools[0]?.groups[0]?.sources[0]?.children?.[0]?.ref,
  ).toEqual({ call: "TreeSign", args: [7, "{sign}"] });
});

test("the load reads the pieces beside the blueprints, from their .piece.json files", () => {
  const out = loadBlueprints({
    "../blueprints/pieces/invented-signs.piece.json": SIGNS,
    "../blueprints/w1/invented-signs-number.blueprint.json": blueprint(
      line(drop),
    ),
  });
  expect(out.refused).toEqual([]);
  expect([...out.stages]).toEqual([["invented-signs-number", "complete"]]);
  expect(
    out.complete.get("invented-signs-number")?.pools[0]?.groups[0]?.sources[0]
      ?.combine,
  ).toBe("sum");
});

test("a param missing or extra, a piece that does not exist and a bad piece call are refused with the reason", () => {
  expect(reason(line({ name: "invented-signs", args: {} }))).toMatch(
    /parâmetro que falta: stat/,
  );
  expect(
    reason(line({ name: "invented-signs", args: { stat: "Drop", mode: 1 } })),
  ).toMatch(/parâmetro que sobra: mode/);
  expect(reason(line({ name: "no-such-piece", args: {} }))).toMatch(
    /pedaço que não existe: no-such-piece/,
  );
  expect(
    reason(line({ name: "invented-signs", args: { stat: { a: 1 } } })),
  ).toMatch(/arg/);
  expect(reason(line({ name: "Bad Name", args: {} }))).toMatch(/piece/);
  // the piece gives the children: a node with both is refused
  expect(reason(line(drop, { leaf: "level" }))).toMatch(/piece/);
  expect(reason(line(drop, { children: [] }))).toMatch(/piece/);
  // a piece's file whose id is not its name
  expect(
    reason(line(drop), { "invented-signs": { ...SIGNS, id: "other" } }),
  ).toMatch(/id/);
});

test("an arg with a replacement pattern fills in as it is: a path it breaks is refused, never a thrown error", () => {
  for (const stat of ["x$&", "$'", "$`"])
    expect(reason(line({ name: "invented-signs", args: { stat } }))).toMatch(
      /ref.read não é um caminho/,
    );
  // a param's name as a property's name stays a name, refused as any key out of the list
  const asKey = signsWith((p) => {
    model(p)["{stat}"] = 1;
  });
  expect(
    reason(line({ name: "invented-signs", args: { stat: 7 } }), {
      "invented-signs": asKey,
    }),
  ).toMatch(/chave fora das listadas: \{stat\}/);
});

test("two pieces with one id, in two folders, refuse the second", () => {
  const out = loadBlueprints({
    "../blueprints/pieces/invented-signs.piece.json": SIGNS,
    "../blueprints/w1/invented-signs.piece.json": SIGNS,
    "../blueprints/w1/invented-signs-number.blueprint.json": blueprint(
      line(drop),
    ),
  });
  expect(out.refused).toEqual([
    {
      file: "../blueprints/w1/invented-signs.piece.json",
      reason: "id repetido: invented-signs já tem pedaço",
    },
  ]);
  expect(out.stages.get("invented-signs-number")).toBe("complete");
});

test("a {name} no param or item fills in is refused on load, in a call's arg and in a name's row; {character} stays", () => {
  const arg = signsWith((p) => {
    model(p).ref = { call: "TreeSign", args: ["{stat}", "{other}"] };
  });
  expect(reason(line(drop), { "invented-signs": arg })).toMatch(
    /\{nome\} não declarado: \{other\}/,
  );
  const row = signsWith((p) => {
    model(p).nameProof = { table: "InventedSigns", row: "{other}" };
  });
  expect(reason(line(drop), { "invented-signs": row })).toMatch(
    /\{nome\} não declarado: \{other\}/,
  );
  const character = signsWith((p) => {
    model(p).ref = { call: "TreeSign", args: ["{stat}", "{character}"] };
  });
  expect(reason(line(drop), { "invented-signs": character })).toBe("loaded");
});

test("an each list never runs over the characters", () => {
  const characters = signsWith((p) => {
    p.each = { list: "PlayerDATABASE[*].Signs", as: "sign" };
  });
  expect(reason(line(drop), { "invented-signs": characters })).toMatch(
    /each.list nunca percorre os personagens/,
  );
});

test("a piece's each list has one [*]: two are only a pool source's", () => {
  const two = signsWith((p) => {
    p.each = { list: "TreeSigns[*][*]", as: ["a", "b"] };
  });
  expect(reason(line(drop), { "invented-signs": two })).toMatch(
    /each.list é um caminho com um \[\*\]/,
  );
});

test("a piece that calls itself, directly or through another piece, is refused", () => {
  const calling = (id: string, other: string) => ({
    id,
    params: [],
    combine: "sum",
    children: [
      {
        key: "again",
        name: "Again",
        ref: { read: "TreeBase" },
        piece: { name: other, args: {} },
      },
    ],
  });
  expect(
    reason(line({ name: "loop-a", args: {} }), {
      "loop-a": calling("loop-a", "loop-a"),
    }),
  ).toMatch(/pedaço que chama a si mesmo: loop-a/);
  expect(
    reason(line({ name: "loop-a", args: {} }), {
      "loop-a": calling("loop-a", "loop-b"),
      "loop-b": calling("loop-b", "loop-a"),
    }),
  ).toMatch(/pedaço que chama a si mesmo: loop-a/);
});

test("every path of a piece passes the ref checks, after its args are filled in, the each list's too", () => {
  // a character's index written out, in a ref and in the list
  const raw = signsWith((p) => {
    model(p).ref = { read: "PlayerDATABASE[0].Signs[{sign}]" };
  });
  expect(reason(line(drop), { "invented-signs": raw })).toMatch(
    /índice de personagem por extenso/,
  );
  const rawList = signsWith((p) => {
    p.each = { list: "PlayerDATABASE[0].Signs[*]", as: "sign" };
  });
  expect(reason(line(drop), { "invented-signs": rawList })).toMatch(
    /índice de personagem por extenso/,
  );
  // an arg that does not make a path
  expect(
    reason(line({ name: "invented-signs", args: { stat: "a b" } })),
  ).toMatch(/ref.read não é um caminho/);
  // the list is a path with one [*]: none, two, or no path
  for (const list of ["TreeSigns", "TreeSigns[*][*]", "TreeSigns + 1"])
    expect(
      reason(line(drop), {
        "invented-signs": signsWith((p) => {
          p.each = { list, as: "sign" };
        }),
      }),
    ).toMatch(/each/);
  // a name the list's item takes that is no identifier, or the tree's character
  for (const as of ["a b", "character"])
    expect(
      reason(line(drop), {
        "invented-signs": signsWith((p) => {
          p.each = { list: "TreeSigns[*]", as };
        }),
      }),
    ).toMatch(/each/);
});

test("each has one model child and a combine; a node with children in a piece has a combine, but a call's level, and only there", () => {
  const two = signsWith((p) => {
    p.children = [model(p), { ...model(p), key: "other" }];
  });
  expect(reason(line(drop), { "invented-signs": two })).toMatch(/filho-modelo/);
  // a call's level with no combine closes by its own recorded count (the Seraph; F r1, the session's decision): it loads
  const noCombine = signsWith((p) => {
    delete model(p).combine;
  });
  expect(reason(line(drop), { "invented-signs": noCombine })).toBe("loaded");
  // a read's level has no count of its own: with children, it asks a combine
  const readNoCombine = signsWith((p) => {
    delete model(p).combine;
    model(p).ref = { read: "TreeSigns[{sign}]" };
  });
  expect(reason(line(drop), { "invented-signs": readNoCombine })).toMatch(
    /combine/,
  );
  const badCombine = signsWith((p) => {
    p.combine = "max";
  });
  expect(reason(line(drop), { "invented-signs": badCombine })).toMatch(
    /combine/,
  );
  // a condition inside a piece is refused: the piece's count has no place for it
  const withCondition = signsWith((p) => {
    model(p).condition = {
      key: "on",
      name: "On",
      ref: { read: "TreeFlagOn" },
      leaf: "condition",
    };
  });
  expect(reason(line(drop), { "invented-signs": withCondition })).toMatch(
    /condition/,
  );
  // below a call's level with no combine (the Seraph), still inside the piece: no condition either
  const seraphCondition = signsWith((p) => {
    const m = model(p);
    delete m.combine;
    const [bonus] = m.children as Raw[];
    if (bonus)
      bonus.condition = {
        key: "on",
        name: "On",
        ref: { read: "TreeFlagOn" },
        leaf: "condition",
      };
  });
  expect(reason(line(drop), { "invented-signs": seraphCondition })).toMatch(
    /condition/,
  );
  // outside a piece, combine and each are refused
  expect(
    reason({
      key: "plain",
      name: "Plain",
      ref: { read: "TreeBase" },
      combine: "sum",
      children: [
        { key: "x", name: "X", ref: { read: "TreeBase" }, leaf: "level" },
      ],
    }),
  ).toMatch(/só em pedaço/);
});
