// The window: the status bar, the panels of the modules that match the context, and the settings.
import { useEffect, useState } from "react";
import { modulesFor } from "../shared/index.ts";
import type { GameContext, Status } from "../shared/index.ts";
import { screenMap } from "./modules/screen-map.ts";
import { SettingsView } from "./SettingsView.tsx";
import { StatusBar } from "./StatusBar.tsx";

const MODULES = [screenMap];
// ponytail: v1 modules never message the main process; module:<id>:* channels when one needs to.
const send = () => Promise.resolve();

export function App() {
  const [ctx, setCtx] = useState<GameContext | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => window.companion.onContext(setCtx), []);
  useEffect(() => window.companion.onStatus(setStatus), []);

  return (
    <main>
      <h1>IdleOn Companion</h1>
      {status && <StatusBar status={status} />}
      {ctx &&
        modulesFor(ctx, MODULES).map(({ id, title, Panel }) => (
          <section key={id}>
            <h2>{title}</h2>
            <Panel ctx={ctx} send={send} />
          </section>
        ))}
      <SettingsView />
    </main>
  );
}
