// Disposable prototype: not product code.
// Roda com o motor como `this`. So percorre propriedades de dados e usa funcoes da linguagem e do navegador:
// nao aciona getters, nao chama nada do jogo e nao deixa nada na pagina. Recebe a lista de caminhos a copiar.
function (paths) {
  var t0 = performance.now(), nodes = 0, onPath = new WeakSet();
  function copyProps(o, d) {
    var r = {}, k = Object.keys(o);
    for (var i = 0; i < k.length; i++) {
      var p = Object.getOwnPropertyDescriptor(o, k[i]);
      if (p && "value" in p) r[k[i]] = walk(p.value, d + 1);
    }
    return r;
  }
  function walk(v, d) {
    nodes++;
    var t = typeof v;
    if (t === "number") return isFinite(v) ? v : { $n: String(v) };
    if (t === "string" || t === "boolean") return v;
    if (v === null || v === undefined) return null;
    if (t === "object" && Object.prototype.toString.call(v) === "[object String]") return String.prototype.valueOf.call(v);
    if (t !== "object" || d > 14 || onPath.has(v)) return { $x: 1 };
    onPath.add(v);
    var res;
    if (Array.isArray(v)) { res = new Array(v.length); for (var i = 0; i < v.length; i++) res[i] = walk(v[i], d + 1); }
    else {
      var proto = Object.getPrototypeOf(v), hd = Object.getOwnPropertyDescriptor(v, "h");
      if (hd && "value" in hd && hd.value && typeof hd.value === "object") {
        var cl = proto && proto.__class__ ? proto.__class__.__name__ : null;
        res = { $m: copyProps(hd.value, d), $c: typeof cl === "string" ? cl : null };
      } else if (proto === Object.prototype || proto === null) res = copyProps(v, d);
      else res = { $x: 1 };
    }
    onPath.delete(v);
    return res;
  }
  var g = this.gameAttributes.h, out = new Array(paths.length);
  for (var n = 0; n < paths.length; n++) {
    var path = paths[n], top = Object.getOwnPropertyDescriptor(g, path[0]);
    if (!top || !("value" in top)) { out[n] = null; continue; }
    var cur = top.value;
    if (path.length > 1) {
      var h = cur ? Object.getOwnPropertyDescriptor(cur, "h") : null;
      var child = h && h.value ? Object.getOwnPropertyDescriptor(h.value, path[1]) : null;
      if (!child || !("value" in child)) { out[n] = null; continue; }
      cur = child.value;
    }
    out[n] = walk(cur, 0);
  }
  return { ms: performance.now() - t0, nodes: nodes, out: out };
}
