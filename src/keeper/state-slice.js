// Copies the pieces in `paths` to plain values, with the engine as `this`; with `null` for `paths`, copies `this` itself
// (an object of the `_vars`). Data properties only: no game function, no getter, nothing left in the page
// (src/keeper/state-read-only.test.ts proves it). Array items are read by index, as measured: no game code defines
// accessors on them.
(function (paths) {
  var onPath = new WeakSet();
  var own = function (o, k) {
    var p = Object.getOwnPropertyDescriptor(o, k);
    return p && "value" in p ? p.value : undefined;
  };
  var className = function (proto) {
    var c = proto ? own(proto, "__class__") : null;
    var n = c ? own(c, "__name__") : null;
    return typeof n === "string" ? n : null;
  };
  var copyProps = function (o, d) {
    var r = {};
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) {
      var p = Object.getOwnPropertyDescriptor(o, keys[i]);
      if (p && "value" in p) r[keys[i]] = walk(p.value, d + 1);
    }
    return r;
  };
  var walk = function (v, d) {
    var t = typeof v;
    // v - v is 0 only for a finite number.
    if (t === "number") return v - v === 0 ? v : { $n: "" + v };
    if (t === "string" || t === "boolean") return v;
    if (v === null || v === undefined) return null;
    if (t !== "object") return { $x: 1 };
    var proto = Object.getPrototypeOf(v);
    if (proto === String.prototype) return String.prototype.valueOf.call(v);
    if (d > 14 || onPath.has(v)) return { $x: 1 };
    onPath.add(v);
    var res;
    if (Array.isArray(v)) {
      res = [];
      for (var i = 0; i < v.length; i++) res[i] = walk(v[i], d + 1);
    } else {
      var h = own(v, "h");
      if (h && typeof h === "object")
        res = { $m: copyProps(h, d), $c: className(proto) };
      else if (proto === Object.prototype || proto === null)
        res = copyProps(v, d);
      else res = { $x: 1 };
    }
    onPath.delete(v);
    return res;
  };
  if (paths === null) return walk(this, 0);
  var g = this.gameAttributes.h;
  var out = [];
  for (var n = 0; n < paths.length; n++) {
    var cur = own(g, paths[n][0]);
    if (paths[n].length > 1) {
      var h = cur && typeof cur === "object" ? own(cur, "h") : null;
      cur = h && typeof h === "object" ? own(h, paths[n][1]) : undefined;
    }
    out[n] = walk(cur, 0);
  }
  var u = own(g, "UserInfo");
  var c = Array.isArray(u) ? u[0] : null;
  var m = own(g, "CurrentMap");
  return {
    char: typeof c === "string" ? c : null,
    map: typeof m === "number" ? m : null,
    out: out,
  };
});
