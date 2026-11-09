// The `_vars` of the closed list (FR-006, FR-007). They live in a closure, next to where a login token may be: they are
// found once per engine with `Runtime.getProperties`, which runs nothing, and only the names of `VARS_KEYS` leave `listed`.
import { VARS_KEYS } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";

export interface VarsReader {
  /** The values of the closed list, or `null` when they cannot be had: it never rejects. A search ends at `isStopped`. */
  read(
    ref: EngineRef,
    isStopped: () => boolean,
  ): Promise<Record<string, unknown> | null>;
  release(ref: EngineRef | null): Promise<void>;
}

const MAX_OBJECTS = 3000;
const MAX_DEPTH = 5;
const MIN_KEYS = 3;
/** Holds the one reference kept between reads. */
const HOLDER_GROUP = "companion-vars";
/** Every handle a read opens; `Runtime.getProperties` hands out new ones each time, so it is emptied after each read. */
const READ_GROUP = "companion-vars-read";

const TAKE_FUNCTION = "function () { return window.React.createElement; }";
const SELF = "function () { return this; }";

interface Remote {
  type?: string;
  objectId?: string;
  description?: string;
  value?: unknown;
  /** How CDP sends a number JSON cannot hold; `value` is absent then. */
  unserializableValue?: string;
}
interface Prop {
  name: string;
  value?: Remote;
}
type Valued = Prop & { value: Remote };

const closedList = new Set(VARS_KEYS);

/** The one place the names are looked at: an accessor has no `value`, so it is never read. */
const listed = (props: Prop[]): Valued[] =>
  props.filter((p): p is Valued => closedList.has(p.name) && "value" in p);

/** `copySource` is the text of `state-slice.js`: by value, the V8 serializer would fire the getters of a game object. */
export function createVarsReader(
  send: Cdp["send"],
  copySource: string,
): VarsReader {
  /** The engine already searched; its search, right or wrong, is not repeated. */
  let searched: string | null = null;
  let holder: string | null = null;

  async function properties(
    ref: EngineRef,
    objectId: string,
  ): Promise<{ result: Prop[]; internal: Prop[] }> {
    const answer = (await send(
      "Runtime.getProperties",
      { objectId, ownProperties: true },
      ref.sessionId,
    )) as {
      result?: Prop[];
      internalProperties?: Prop[];
      exceptionDetails?: unknown;
    };
    if (answer.exceptionDetails !== undefined || !Array.isArray(answer.result))
      throw new Error("the read failed");
    return {
      result: answer.result,
      internal: answer.internalProperties ?? [],
    };
  }

  async function run(
    ref: EngineRef,
    objectId: string,
    functionDeclaration: string,
    returnByValue: boolean,
    objectGroup: string,
    args: { value: unknown }[] = [],
  ): Promise<Remote> {
    const answer = (await send(
      "Runtime.callFunctionOn",
      {
        objectId,
        functionDeclaration,
        returnByValue,
        objectGroup,
        arguments: args,
      },
      ref.sessionId,
    )) as { result?: Remote; exceptionDetails?: unknown };
    if (answer.exceptionDetails !== undefined || !answer.result)
      throw new Error("the read failed");
    return answer.result;
  }

  async function handle(
    ref: EngineRef,
    objectId: string,
    declaration: string,
    group: string,
  ): Promise<string> {
    const id = (await run(ref, objectId, declaration, false, group)).objectId;
    if (id === undefined) throw new Error("the read failed");
    return id;
  }

  const releaseGroup = async (ref: EngineRef, objectGroup: string) => {
    try {
      await send("Runtime.releaseObjectGroup", { objectGroup }, ref.sessionId);
    } catch {
      // the game may be gone, and the group with it
    }
  };

  /** Walks the scopes of the function, breadth first, and keeps a reference to the first object with the keys. */
  async function search(
    ref: EngineRef,
    isStopped: () => boolean,
  ): Promise<string | null> {
    const fn = await handle(ref, ref.objectId, TAKE_FUNCTION, READ_GROUP);
    const scopes = (await properties(ref, fn)).internal.find(
      (p) => p.name === "[[Scopes]]",
    )?.value?.objectId;
    if (scopes === undefined) return null;
    const queue: { id: string; depth: number }[] = [];
    for (const { value } of (await properties(ref, scopes)).result)
      if (value?.objectId && !value.description?.startsWith("Global"))
        queue.push({ id: value.objectId, depth: 0 });
    // ponytail: no visited set, as CDP gives a new id to each sight of an object; the depth and the limit end the walk.
    for (const { id, depth } of queue) {
      if (isStopped()) return null;
      const { result } = await properties(ref, id);
      // A scope object (depth 0) is V8's copy of the moment: read again, it would never change.
      if (depth > 0 && listed(result).length >= MIN_KEYS)
        return handle(ref, id, SELF, HOLDER_GROUP);
      if (depth === MAX_DEPTH) continue;
      for (const { value } of result)
        if (
          value?.type === "object" &&
          value.objectId &&
          queue.length < MAX_OBJECTS
        )
          queue.push({ id: value.objectId, depth: depth + 1 });
    }
    return null;
  }

  async function readHolder(
    ref: EngineRef,
    objectId: string,
  ): Promise<Record<string, unknown>> {
    const self = await handle(ref, objectId, SELF, READ_GROUP);
    const out: Record<string, unknown> = {};
    for (const { name, value } of listed((await properties(ref, self)).result))
      out[name] = value.objectId
        ? (
            await run(ref, value.objectId, copySource, true, READ_GROUP, [
              { value: null },
            ])
          ).value
        : value.unserializableValue !== undefined
          ? { $n: value.unserializableValue }
          : value.value;
    return out;
  }

  return {
    async read(ref, isStopped) {
      const engine = `${ref.sessionId}:${ref.objectId}`;
      if (engine === searched && holder === null) return null;
      try {
        if (engine !== searched) {
          searched = engine;
          holder = await search(ref, isStopped);
        }
        return holder === null ? null : await readHolder(ref, holder);
      } catch {
        holder = null;
        return null;
      } finally {
        await releaseGroup(ref, READ_GROUP);
      }
    },
    async release(ref) {
      searched = null;
      holder = null;
      if (ref) await releaseGroup(ref, HOLDER_GROUP);
    },
  };
}
