// The window: only the setup screen while Steam is not set up (FR-005); after it, the status bar, the panels of the
// modules that match the context, and the settings.
import { useCallback, useEffect, useState } from "react";
import { modulesFor } from "../shared/index.ts";
import type {
  GameContext,
  Stats,
  Status,
  SteamState,
} from "../shared/index.ts";
import { screenMap } from "./modules/screen-map.ts";
import { SettingsView, SteamSettings } from "./SettingsView.tsx";
import { SetupView, steamUnknown } from "./SetupView.tsx";
import { StatsPanel } from "./StatsPanel.tsx";
import { StatusBar } from "./StatusBar.tsx";

const MODULES = [screenMap];
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
    <main>
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
            <button
              type="button"
              role="tab"
              aria-selected={tab === "map"}
              onClick={() => {
                setTab("map");
              }}
            >
              Screen map
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "stats"}
              onClick={() => {
                setTab("stats");
              }}
            >
              Stats
            </button>
          </div>
          {tab === "stats" && <StatsPanel stats={stats} />}
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
    </main>
  );
}
