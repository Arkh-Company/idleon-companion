// The v1 module (spec §6.3): Screen map, always shown.
import type { CompanionModule } from "../../shared/index.ts";
import { ScreenMapPanel } from "../ScreenMapPanel.tsx";

export const screenMap: CompanionModule = {
  id: "screen-map",
  title: "Screen map",
  needs: ["live-screen"],
  matches: () => true,
  Panel: ScreenMapPanel,
};
