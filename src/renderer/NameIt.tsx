// "Name it" (spec §5.6): Enter saves the name; the main process marks it confirmed and sends the context again.
import { useState } from "react";
import type { CatalogTable } from "../shared/index.ts";

export function NameIt({
  table,
  catalogKey,
}: {
  table: CatalogTable;
  catalogKey: string;
}) {
  const [name, setName] = useState("");
  return (
    <input
      className="name-it"
      aria-label="Name it"
      placeholder="Name it"
      value={name}
      onChange={(e) => {
        setName(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || name.trim() === "") return;
        void window.companion.name(table, catalogKey, name.trim());
      }}
    />
  );
}
