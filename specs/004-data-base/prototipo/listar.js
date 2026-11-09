// Disposable prototype: not product code.
// Lista as chaves do estado, sem copiar valores. Os nomes dos filhos ficam so na memoria do script, nunca em arquivo.
function () {
  var SKIP = { CustomLists: 1, ItemDefinitionsGET: 1, MonsterDefinitionsGET: 1, DialogueDefGET: 1, PixelHelperActor: 1, CustomMaps: 1 };
  var SPLIT = { PlayerDATABASE: 1, DNSM: 1 };
  var g = this.gameAttributes.h, keys = Object.keys(g), skipped = [], top = [], split = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (SKIP[k]) { skipped.push(k); continue; }
    var p = Object.getOwnPropertyDescriptor(g, k);
    if (!p || !("value" in p)) continue;
    if (SPLIT[k] && p.value && typeof p.value === "object") {
      var hd = Object.getOwnPropertyDescriptor(p.value, "h");
      if (hd && "value" in hd && hd.value && typeof hd.value === "object") {
        var proto = Object.getPrototypeOf(p.value), cl = proto && proto.__class__ ? proto.__class__.__name__ : null;
        split[k] = { children: Object.keys(hd.value), cls: typeof cl === "string" ? cl : null };
        continue;
      }
    }
    top.push(k);
  }
  return { top: top, split: split, skipped: skipped };
}
