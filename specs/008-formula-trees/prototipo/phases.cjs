// Disposable prototype: not product code.
// Preloaded with `node -r` into the bench's recorder: times every run inside a node:vm context and the require of the
// bench's own modules, and prints one line "PHASE {json}" per step to stderr. It records only the code's length and
// the time, never the code's text, so no game code leaves.
"use strict";
const vm = require("node:vm");
const Module = require("node:module");
const t0 = performance.now();
const at = () => Math.round(performance.now() - t0);
const log = (o) => process.stderr.write("PHASE " + JSON.stringify({ at: at(), ...o }) + "\n");

const run = vm.runInContext;
vm.runInContext = function (code, ...rest) {
  const s = performance.now();
  try {
    return run.call(this, code, ...rest);
  } finally {
    const ms = Math.round(performance.now() - s);
    if (ms >= 20) log({ step: "runInContext", codeLength: String(code).length, ms });
  }
};
const scriptRun = vm.Script.prototype.runInContext;
vm.Script.prototype.runInContext = function (...args) {
  const s = performance.now();
  try {
    return scriptRun.apply(this, args);
  } finally {
    const ms = Math.round(performance.now() - s);
    if (ms >= 20) log({ step: "script.runInContext", ms });
  }
};
const load = Module._load;
Module._load = function (request, ...rest) {
  const s = performance.now();
  try {
    return load.call(this, request, ...rest);
  } finally {
    const ms = Math.round(performance.now() - s);
    if (ms >= 50 && /\.cjs$|instrument|helpers|pieces|snapshot/.test(request))
      log({ step: "require", module: request.split(/[\\/]/).pop(), ms });
  }
};
process.on("exit", () => log({ step: "exit" }));
