// The tree worker's reader of the installed game's tables for the names (spec 008, T023; tree/names.ts), loaded as text
// and run inside the context after the context's own code. It gives, as JSON text only, the text of each cell the name
// recipes read (null when it is no text) and each table the recipes read in the bench's canonical form (every {h: ...}
// wrapper unwrapped, the keys sorted), which the worker hashes to tell a patched table.
(function () {
  "use strict";
  var G = globalThis;
  var mapOf = (v) =>
    !Array.isArray(v) && v.h && typeof v.h === "object" ? v.h : v;

  function canon(v) {
    if (!v || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(canon);
    var keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === "h" && v.h && typeof v.h === "object")
      return canon(v.h);
    var out = {};
    keys.sort().forEach((k) => {
      out[k] = canon(v[k]);
    });
    return out;
  }

  // "CustomLists.X" is a list of the family, "ItemDefinitionsGET" the family itself.
  function tableOf(id) {
    var dot = id.indexOf(".");
    var family = G.__calc.gameTable(dot < 0 ? id : id.slice(0, dot));
    if (dot < 0 || family == null) return family;
    var all = mapOf(family);
    return Object.prototype.hasOwnProperty.call(all, id.slice(dot + 1))
      ? all[id.slice(dot + 1)]
      : undefined;
  }

  function cell(table, index, field) {
    var v = tableOf(table);
    index.forEach((k) => {
      v = v == null ? v : mapOf(v)[k];
    });
    if (field !== null) v = v == null ? v : (v.h || v)[field];
    return typeof v === "string" ? v : null;
  }

  G.__names = {
    // { cells: [[table, index, field]], tables: [id] } -> { texts: [text | null], forms: [JSON text | null] }
    read: (askJson) => {
      var ask = JSON.parse(askJson);
      return JSON.stringify({
        texts: ask.cells.map((c) => cell(c[0], c[1], c[2])),
        forms: ask.tables.map((id) => {
          var v = tableOf(id);
          return v === undefined ? null : JSON.stringify(canon(v));
        }),
      });
    },
  };
})();
