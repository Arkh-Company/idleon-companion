// Disposable prototype: not product code.
// Preloaded with `node -r` into the bench: turns off the two parts of the N.js index (spec 007) that cannot go into the
// app, the dictionary of proven names (dictionary.cjs meaning, dict-names.cjs) and the names catalog in SQLite
// (research/index/catalog.sqlite). The game's tables the index also serves stay on: in the app they come from the
// installed game. Used to count how many rows of the Drop Rate tree lose their name without spec 007.
"use strict";
const Module = require("node:module");
const sqlite = require("node:sqlite");

const Real = sqlite.DatabaseSync;
const empty = { get: () => undefined, all: () => [], iterate: () => [][Symbol.iterator](), run: () => ({}) };
sqlite.DatabaseSync = class extends Real {
  constructor(file, ...rest) {
    super(file, ...rest);
    this.off = /research[\\/]index[\\/]catalog\.sqlite$/.test(String(file));
  }
  prepare(sql) {
    return this.off ? empty : super.prepare(sql);
  }
};

const load = Module._load;
Module._load = function (request, ...rest) {
  if (/njs-index[\\/]dictionary\.cjs$/.test(request)) return { meaning: () => ({}) };
  // dict-names.cjs returns a function with helper methods (changedBy, isOwnLevel...): every one answers "nothing".
  if (/dict-names\.cjs$/.test(request))
    return () => new Proxy(() => null, { get: (f, k) => (k in f ? f[k] : () => null) });
  return load.call(this, request, ...rest);
};
