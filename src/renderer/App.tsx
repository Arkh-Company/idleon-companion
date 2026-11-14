// The window: only the setup screen while Steam is not set up (FR-005); after it, the status bar, the panels of the
// modules that match the context, and the settings. A tapped Stats value opens its tree in the side panel, beside the
// rest, with the window widened (spec 008 FR-005).
import { useCallback, useEffect, useRef, useState } from "react";
import { modulesFor } from "../shared/index.ts";
import type {
  FormulaTree,
  GameContext,
  Stats,
  Status,
  SteamState,
} from "../shared/index.ts";
import { screenMap } from "./modules/screen-map.ts";
import { SettingsView, SteamSettings } from "./SettingsView.tsx";
import { SetupView, steamUnknown } from "./SetupView.tsx";
import { SidePanel } from "./SidePanel.tsx";
import type { Side } from "./SidePanel.tsx";
import { STATS_TREES, StatsPanel } from "./StatsPanel.tsx";
import type { StatsRow } from "./StatsPanel.tsx";
import { StatusBar } from "./StatusBar.tsx";

const MODULES = [screenMap];
const TABS = [
  ["map", "Screen map"],
  ["stats", "Stats"],
] as const;
// ponytail: v1 modules never message the main process; module:<id>:* channels when one needs to.
const send = () => Promise.resolve();

export function App() {
  const [ctx, setCtx] = useState<GameContext | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => window.companion.onContext(setCtx), []);
  useEffect(() => window.companion.onStatus(setStatus), []);
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => window.companion.onStats(setStats), []);
  const [tab, setTab] = useState<"map" | "stats">("map");
  const [formula, setFormula] = useState<FormulaTree>({ state: "none" });
  useEffect(() => window.companion.onFormula(setFormula), []);
  const [side, setSide] = useState<Side | null>(null);
  /** The number that opened the panel: ✕ gives the focus back to it (FR-039). */
  const opener = useRef<HTMLElement | null>(null);

  /** The window grew to the left: the panel goes on the left, so the Stats stays under the cursor (FR-005). */
  const [left, setLeft] = useState(false);
  /** Each open and close counts: a widening that ends after a close is ignored. */
  const turn = useRef(0);

  function widen(): void {
    const before = window.screenX;
    const mine = ++turn.current;
    void window.companion.setSidePanel({ open: true }).then(() => {
      if (turn.current === mine && window.screenX < before) setLeft(true);
    });
  }
  function openSide(row: StatsRow, from: HTMLElement): void {
    const trees = STATS_TREES[row.label];
    if (!trees) return;
    opener.current = from;
    if (!side) widen();
    const id = trees.length === 1 ? (trees[0]?.[0] ?? null) : null;
    setSide({ label: row.label, text: row.text, trees, id });
    if (id) void window.companion.requestFormula({ id });
  }
  function closeSide(): void {
    turn.current++;
    setSide(null);
    setLeft(false);
    void window.companion.setSidePanel({ open: false });
    void window.companion.closeFormula();
    opener.current?.focus();
  }
  function pick(id: string): void {
    setSide((s) => s && { ...s, id });
    void window.companion.requestFormula({ id });
  }
  function expand(nodeId: string): void {
    if (side?.id)
      void window.companion.requestFormula({ treeId: side.id, nodeId });
  }

  // Null until the main process answers, so the 001 window never flashes before the setup screen.
  const [steam, setSteam] = useState<SteamState | null>(null);
  // The setup screen stays mounted above the window, down to its final line.
  const [setupFinished, setSetupFinished] = useState(false);
  const loadSteam = useCallback(() => {
    void window.companion.steamState().then(setSteam, (e: unknown) => {
      setSteam(steamUnknown(e));
    });
  }, []);
  useEffect(loadSteam, [loadSteam]);
  const finishSetup = useCallback(() => {
    setSetupFinished(true);
  }, []);
  // A new key: the setup screen starts over, without the last line of the setup before.
  const [setupRun, setSetupRun] = useState(0);
  const showSteam = useCallback((s: SteamState) => {
    setSetupFinished(false);
    setSetupRun((n) => n + 1);
    setSteam(s);
  }, []);

  return (
    <main
      className={
        side ? `app with-side${left ? " with-side--left" : ""}` : "app"
      }
    >
      <div className="main-panel">
        <h1>IdleOn Companion</h1>
        {steam && (!steam.configured || setupFinished) && (
          <SetupView
            key={setupRun}
            state={steam}
            onReload={loadSteam}
            onFinished={finishSetup}
          />
        )}
        {steam && (steam.configured || setupFinished) && (
          <>
            {status && <StatusBar status={status} />}
            <div role="tablist" className="tabs">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => {
                    setTab(id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "stats" && <StatsPanel stats={stats} onOpen={openSide} />}
            {tab === "map" &&
              ctx &&
              modulesFor(ctx, MODULES).map(({ id, title, Panel }) => (
                <section key={id}>
                  <h2>{title}</h2>
                  <Panel ctx={ctx} send={send} />
                </section>
              ))}
            <SettingsView>
              <SteamSettings onReload={loadSteam} onSteam={showSteam} />
            </SettingsView>
          </>
        )}
      </div>
      {side && (
        <SidePanel
          side={side}
          tree={formula}
          onClose={closeSide}
          onPick={pick}
          onExpand={expand}
        />
      )}
    </main>
  );
}
