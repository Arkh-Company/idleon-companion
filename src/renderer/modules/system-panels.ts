// The system panels (spec 008 FR-003): one module per catalog system with a screen, made from the catalog, shown while
// that screen or one of its tabs is open in the game (the deepest screen wins, shared/tree-catalog.ts).
import { createElement } from "react";
import { PANEL_SCREENS, panelSystems } from "../../shared/index.ts";
import type { CompanionModule } from "../../shared/index.ts";
import { SystemPanel } from "../SystemPanel.tsx";

export const SYSTEM_PANELS: readonly CompanionModule[] = [
  ...PANEL_SCREENS.keys(),
].map((system) => ({
  id: system,
  title: system,
  needs: ["live-screen", "game-code"],
  matches: (ctx) => panelSystems(ctx.screen.label).includes(system),
  Panel: () => createElement(SystemPanel, { system }),
}));
