// Disposable prototype: not product code.
// Preloaded with `node -r` into a measured process: samples the V8 heap every 50 ms and, on exit, prints one line
// "PEAK {json}" to stderr with the peak heap used, the peak RSS and the wall time. Prints no game data.
"use strict";
const v8 = require("node:v8");
const t0 = Date.now();
let heap = 0;
let rss = 0;
function sample() {
  heap = Math.max(heap, v8.getHeapStatistics().used_heap_size);
  rss = Math.max(rss, process.memoryUsage.rss());
}
const timer = setInterval(sample, 50);
timer.unref();
process.on("exit", (code) => {
  sample();
  process.stderr.write(
    "PEAK " +
      JSON.stringify({
        code,
        ms: Date.now() - t0,
        heapMb: Math.round(heap / 1048576),
        rssMb: Math.round(rss / 1048576),
        maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
      }) +
      "\n",
  );
});
