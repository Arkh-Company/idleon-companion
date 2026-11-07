// Entry of the one executable (package.json "main", out/main/start.js): picks the role from the command line and
// loads only that role's bundle (contracts/command-line.md). Nothing else lives in src/start/.
import { roleFor } from "./dispatch.ts";

const role = roleFor(process.argv);
if (role === "keeper") await import("../keeper/index.ts");
else if (role === "remove-from-steam")
  await import("../main/remove-from-steam.ts");
else await import("../main/index.ts");
