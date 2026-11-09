// Disposable prototype: not product code.
// Junta as etapas do catalogo: inventario, natureza (texto do jogo local), impacto medido, quando muda e mecanica.
// Le retratos e o jogo de fora do repositorio. So nomes, tipos e tamanhos vao para catalogo.md.
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const LAB = "C:/Users/Vinicius/idleon-companion";
const SAIDA = `${LAB}/lab/out/prototipo-005`;
const RETRATOS = `${SAIDA}/retratos`;
const arquivos = fs.readdirSync(RETRATOS).filter((f) => f.endsWith(".json")).sort();

const tipoDe = (v) =>
  v === null || v === undefined ? "vazio"
  : Array.isArray(v) ? "lista"
  : typeof v === "object" ? ("$m" in v ? "mapa" : "$n" in v ? "número" : "$x" in v ? "não copiável" : "objeto")
  : typeof v === "number" ? "número" : typeof v === "string" ? "texto" : typeof v;

// Uma peca do retrato: nome no catalogo -> valor. Os personagens nunca aparecem pelo nome.
function pecasDe(r) {
  const o = {};
  const a = r.attrs;
  for (const k of Object.keys(a)) if (k !== "DNSM" && k !== "PlayerDATABASE") o[k] = a[k];
  for (const k of Object.keys(a.DNSM?.$m ?? {})) o[`DNSM.${k}`] = a.DNSM.$m[k];
  const db = a.PlayerDATABASE?.$m ?? {};
  const atual = a.UserInfo?.[0];
  for (const [n, p] of Object.entries(db))
    for (const k of Object.keys(p.$m ?? {})) {
      if (n === atual) o[`Personagem.${k}`] = p.$m[k];
      else (o[`OutrosPersonagens.${k}`] ??= { $outros: [] }).$outros.push(p.$m[k]);
    }
  for (const k of Object.keys(r.vars ?? {})) o[`_vars.${k}`] = r.vars[k];
  return o;
}
const valorTipo = (v) => (v && v.$outros ? tipoDe(v.$outros[0]) : tipoDe(v));

// 1. Inventario e 4. quando muda.
const JANELAS = [
  ["tirar item", "161719007", "161805674"],
  ["colocar item", "161805674", "161823382"],
  ["trocar obol", "161823382", "161900253"],
  ["talento", "161900253", "161928029"],
  ["parado", "161928029", "162115087"],
  ["buff", "162115087", "162204315"],
  ["trocar mapa", "162204315", "162229097"],
  ["matar", "162229097", "162334922"],
  ["parado", "162334922", "999999999"],
];
const janelaDe = (f) => JANELAS.find(([, a, b]) => f.slice(0, 9) >= a && f.slice(0, 9) < b)?.[0];
const DIA_A_DIA = new Set(["tirar item", "colocar item", "trocar obol", "talento", "buff", "trocar mapa"]);

const inventario = new Map();
const proibidos = new Set();
let anterior = null;
for (const f of arquivos) {
  const r = JSON.parse(fs.readFileSync(`${RETRATOS}/${f}`, "utf8"));
  Object.keys(r.attrs.PlayerDATABASE?.$m ?? {}).forEach((n) => proibidos.add(n));
  const texto = {};
  for (const [k, v] of Object.entries(pecasDe(r))) {
    texto[k] = JSON.stringify(v) ?? "";
    const it = inventario.get(k) ?? { nome: k, muda: new Map() };
    it.tipo = valorTipo(v);
    it.tamanho = texto[k].length;
    inventario.set(k, it);
  }
  const j = janelaDe(f);
  if (anterior && j)
    for (const k of Object.keys(texto))
      if (k in anterior && anterior[k] !== texto[k]) {
        const m = inventario.get(k).muda;
        m.set(j, (m.get(j) || 0) + 1);
      }
  anterior = texto;
}
// Entradas do DNSM vistas numa sessao mais longa, ausentes deste roteiro.
const antigo = `${LAB}/lab/out/prototipo-004/comparar-inteiro/retrato.json`;
if (fs.existsSync(antigo)) {
  const r = JSON.parse(fs.readFileSync(antigo, "utf8"));
  if (r.attrs)
    for (const [k, v] of Object.entries(pecasDe(r)))
      if (!inventario.has(k)) inventario.set(k, { nome: k, muda: new Map(), tipo: valorTipo(v), tamanho: JSON.stringify(v)?.length ?? 0, soAntigo: true });
}

// 3. Impacto medido.
const impacto = new Map();
for (const estado of ["parado", "trocado"]) {
  const arq = `${SAIDA}/impacto-${estado}.jsonl`;
  if (!fs.existsSync(arq)) continue;
  for (const l of fs.readFileSync(arq, "utf8").split("\n").filter(Boolean)) {
    const x = JSON.parse(l);
    const it = impacto.get(x.peca) ?? { numeros: new Set(), quebrou: new Set(), estados: new Set() };
    x.numeros.forEach((n) => it.numeros.add(n));
    x.quebrou.forEach((n) => it.quebrou.add(n));
    it.estados.add(estado);
    impacto.set(x.peca, it);
  }
}

// 2. Natureza: quem le e quem grava, no texto do jogo local.
const c = fs.readFileSync(`${LAB}/research/run/N.game.js`, "utf8");
const rotinas = [];
// Cada funcao com nome proprio e uma rotina; nomes de uma ou duas letras sao variaveis internas do codigo minificado.
for (let p = c.indexOf("function("); p >= 0; p = c.indexOf("function(", p + 9)) {
  if (c[p - 1] !== "=" && c[p - 1] !== ":") continue;
  let i = p - 1;
  while (i > 0 && p - i < 90 && /[\w$]/.test(c[i - 1])) i--;
  if (p - 1 - i >= 3) rotinas.push([i, c.slice(i, p - 1).replace(/^_customBlock_/, "")]);
}
rotinas.sort((a, b) => a[0] - b[0]);
function rotinaEm(p) {
  let a = 0, b = rotinas.length - 1, r = "";
  while (a <= b) {
    const m = (a + b) >> 1;
    if (rotinas[m][0] <= p) { r = rotinas[m][1]; a = m + 1; } else b = m - 1;
  }
  return r;
}
const uso = new Map();
const eventos = [];
const nota = (k, tipo, p) => eventos.push([p, k, tipo]);
function aplicaEventos() {
  eventos.sort((a, b) => a[0] - b[0]);
  for (const [p, k, tipo] of eventos) {
    const u = uso.get(k) ?? { le: new Map(), grava: new Map(), primeiro: new Map() };
    const r = rotinaEm(p);
    u[tipo].set(r, (u[tipo].get(r) || 0) + 1);
    if (!u.primeiro.has(r)) u.primeiro.set(r, tipo);
    uso.set(k, u);
  }
}
const nomesDNSM = new Set([...inventario.keys()].filter((k) => k.startsWith("DNSM.")).map((k) => k.slice(5)));
const nomesSub = new Set([...inventario.keys()].filter((k) => k.startsWith("Personagem.")).map((k) => k.slice(11)));
for (const m of c.matchAll(/getGameAttribute\("(\w+)"\)(?:\.h\.(\w+)((?:[-+*/])?=(?!=))?|\.(push|splice|pop|shift)\(|(\[[^\][]{1,40}\]=(?!=)))?/g)) {
  const [, topo, membro, gravaMembro, muta, indice] = m;
  if (topo === "DNSM" && membro) nota(`DNSM.${membro}`, gravaMembro ? "grava" : "le", m.index);
  else nota(topo, muta || indice ? "grava" : "le", m.index);
}
for (const m of c.matchAll(/gameAttributes\.h\.(\w+)((?:[-+*/])?=(?!=))?/g)) nota(m[1], m[2] ? "grava" : "le", m.index);
for (const m of c.matchAll(/\.h\.(\w+)(?:[-+*/])?=(?!=)/g)) if (nomesDNSM.has(m[1]) && !c.startsWith("gameAttributes", m.index - 14)) nota(`DNSM.${m[1]}`, "grava", m.index);
for (const m of c.matchAll(/\.h\.(\w+)((?:[-+*/])?=(?!=))?/g)) if (nomesSub.has(m[1]) && c.startsWith("]", m.index - 1)) nota(`Personagem.${m[1]}`, m[2] ? "grava" : "le", m.index);
aplicaEventos();
const iSave = c.indexOf("_customBlock_CloudSAVE=function");
const fimSave = c.indexOf("_customBlock_", iSave + 30);
const salvos = new Set([...c.slice(iSave, fimSave).matchAll(/getGameAttribute\("(\w+)"\)/g)].map((m) => m[1]));
salvos.delete("UserInfo");
salvos.delete("GetPlayersUsernames");

function natureza(it) {
  const k = it.nome;
  if (k.startsWith("_vars.") || k.startsWith("Personagem.") || k.startsWith("OutrosPersonagens.")) return "dado de origem";
  if (/^DNSM\./.test(k)) {
    // Quem muda um numero ao ser alterado e consultado antes de ser refeito: nao e rascunho.
    if (impacto.get(k)?.numeros.size) return "cache derivado";
    const u = uso.get(k);
    if (!u) return "cache derivado";
    const leitores = [...u.le.keys()], gravadores = [...u.grava.keys()];
    // Rascunho: em toda funcao que o usa, a primeira coisa e grava-lo; um cache e consultado antes de ser refeito.
    if (leitores.length && leitores.every((r) => u.primeiro.get(r) === "grava")) return "rascunho";
    if (gravadores.length <= 1 && !it.muda.size) return "tabela fixa";
    return "cache derivado";
  }
  if (salvos.has(k)) return "dado de origem";
  if (/dummy/i.test(k)) return "rascunho";
  const u = uso.get(k);
  if (!u || !u.grava.size) return it.muda.size ? "interface" : "tabela fixa";
  const bloco = [...u.le.keys()].some((r) => !/^(_event_|init$|_Script|new$)/.test(r));
  if (!it.muda.size && u.grava.size <= 1) return "tabela fixa";
  return bloco ? "cache derivado" : "interface";
}

// 5. Mecanica: pelo nome da peca e das rotinas que a usam.
const MECANICAS = [
  [/stamp/i, "Stamps"], [/card/i, "Cards"], [/obol/i, "Obols"], [/talent|\bTal[A-Z]/, "Talentos"], [/starsign|star_?sign/i, "Star Signs"],
  [/prayer/i, "Prayers"], [/statue/i, "Estátuas"], [/shrine/i, "Shrines"], [/cauld|alchem|bubble|vial|p2w/i, "Alquimia"],
  [/meal|cook|food|ribbon/i, "Comida e cozinha"], [/refine|salt/i, "Refinaria"], [/atom/i, "Átomos"], [/construct|tower|build/i, "Construção"],
  [/forge|anvil|smith/i, "Forja e bigorna"], [/guild/i, "Guilda"], [/arcade/i, "Arcade"], [/companion|pet\b|breed|territ/i, "Pets e companheiros"],
  [/shiny/i, "Pets e companheiros"], [/sailing|boat|captain|artifact|anci/i, "Sailing"], [/gaming|sprout|fert/i, "Gaming"], [/divin|god/i, "Divinity"],
  [/lab|chip|jewel/i, "Laboratório"], [/farm|crop/i, "Farming"], [/summon/i, "Summoning"], [/ninja|sneak/i, "Sneaking"], [/hole|cavern/i, "Holes"],
  [/equip|item|inventory|chest|bag|armor|weapon/i, "Itens e equipamento"], [/quest|npc|dialog/i, "Quests e NPCs"], [/^(Current)?Map|scene|portal|respawn/i, "Mapa"],
  [/monster|kill|node|dmg|damage/i, "Combate"], [/afk|away/i, "AFK"], [/buff/i, "Buffs"], [/skill|exp|lv0/i, "Skills e experiência"], [/stat|hp|mp\b|acc/i, "Status do personagem"],
  [/option|chat|popup|text|ui|menu|minimize|tutorial/i, "Interface"], [/mine|fish|catch|bug|chop|worship|trap/i, "Skills de coleta"], [/task|achiev|merit/i, "Tarefas e conquistas"], [/vote|event|happy|tome/i, "Eventos da conta"],
];
const GENERICAS = /^(ArbitraryCode|RunCodeOfType|ArbCode|1second|5sec|DummyNumber|CommaNotation|NotateNumber|getLOG|Log2|LoadPlayerInfo|CloudSAVE|SaveGamee)/;
function mecanica(it) {
  const curto = it.nome.replace(/^(DNSM|Personagem|OutrosPersonagens|_vars)\./, "");
  for (const [re, m] of MECANICAS) if (re.test(curto)) return m;
  const u = uso.get(it.nome);
  if (u) {
    const conta = new Map();
    for (const mapa of [u.le, u.grava]) for (const [r, n] of mapa) if (!GENERICAS.test(r)) conta.set(r, (conta.get(r) || 0) + n);
    for (const [r] of [...conta].sort((a, b) => b[1] - a[1])) {
      const limpo = r.replace(/^_(customEvent|event)_/, "");
      for (const [re, m] of MECANICAS) if (re.test(limpo)) return `${m} (a conferir)`;
    }
  }
  return "a conferir";
}

const TODOS = 11;
const linhas = [];
for (const it of [...inventario.values()].sort((a, b) => a.nome.localeCompare(b.nome))) {
  const imp = impacto.get(it.nome);
  const nums = imp ? [...imp.numeros] : [];
  const muda = [...it.muda.keys()];
  const dia = muda.some((j) => DIA_A_DIA.has(j));
  const rapida = nums.length > 0 && dia;
  linhas.push({
    nome: it.nome, tipo: it.tipo, tamanho: it.tamanho, natureza: natureza(it),
    numeros: !imp ? "não medido" : nums.length === TODOS ? "todos" : nums.join(", ") || (imp.quebrou.size ? "só quebra" : "nenhum"),
    muda: muda.join(", ") || "não mudou",
    mecanica: mecanica(it),
    feature: nums.length ? "Stats" : "—",
    leitura: rapida ? "rápida" : "lenta",
    impactoSemMudar: nums.length > 0 && !dia, medido: !!imp,
  });
}

const destino = path.join(__dirname, "catalogo.md");
let md = `# Catálogo de leitura\n\nProtótipo da 005, gerado por \`catalogo.cjs\`. Uma linha por peça do estado, só com nomes, tipos e tamanhos.\n\n`;
md += `| Peça | Tipo | Bytes | Natureza | Números afetados | Muda em | Mecânica | Feature | Leitura |\n| --- | --- | ---: | --- | --- | --- | --- | --- | --- |\n`;
for (const l of linhas) md += `| \`${l.nome}\` | ${l.tipo} | ${l.tamanho} | ${l.natureza} | ${l.numeros} | ${l.muda} | ${l.mecanica} | ${l.feature} | ${l.leitura} |\n`;
for (const n of proibidos) if (md.includes(n)) throw new Error("nome de personagem no catalogo");
fs.writeFileSync(destino, md);
fs.writeFileSync(`${SAIDA}/catalogo-linhas.json`, JSON.stringify(linhas));

const conta = (f) => { const o = {}; for (const l of linhas) { const k = f(l); o[k] = (o[k] || 0) + 1; } return o; };
console.log("pecas", linhas.length, "medidas", linhas.filter((l) => l.medido).length);
console.log("leitura", conta((l) => l.leitura), "bytes rapida", linhas.filter((l) => l.leitura === "rápida").reduce((s, l) => s + l.tamanho, 0));
console.log("natureza", conta((l) => l.natureza));
console.log("mecanica", conta((l) => l.mecanica));
console.log("impacto sem mudar no roteiro", linhas.filter((l) => l.impactoSemMudar).length);
console.log("salvos", salvos.size, "rotinas", rotinas.length, "uso", uso.size);
// Quanto a leitura rapida precisa trazer em cada acao: decide se o que muda junto cabe numa fatia so.
const rapidas = linhas.filter((l) => l.leitura === "rápida");
for (const j of DIA_A_DIA) {
  const m = rapidas.filter((l) => l.muda.split(", ").includes(j));
  console.log(`fatia ${j}: ${m.length} pecas, ${m.reduce((s, l) => s + l.tamanho, 0)} bytes`);
}
const tabela = (lista) => lista.map((l) => `| \`${l.nome}\` | ${l.tamanho} | ${l.natureza} | ${l.numeros} | ${l.muda} | ${l.mecanica} |`).join("\n");
const cab = "| Peça | Bytes | Natureza | Números | Muda em | Mecânica |\n| --- | ---: | --- | --- | --- | --- |\n";
const parado = (l) => l.muda.split(", ").includes("parado");
const soAcao = rapidas.filter((l) => !parado(l)), tambem = rapidas.filter(parado), semMudar = linhas.filter((l) => l.impactoSemMudar);
const bytes = (a) => a.reduce((s, l) => s + l.tamanho, 0);
console.log(`grupos: so acao ${soAcao.length}/${bytes(soAcao)} | muda parado ${tambem.length}/${bytes(tambem)} | sem mudar ${semMudar.length}/${bytes(semMudar)}`);
const secao = (t, a) => `## ${t} (${a.length} peças, ${bytes(a)} bytes)\n\n${cab}${tabela(a)}\n\n`;
fs.writeFileSync(path.join(__dirname, "revisar.md"), `# Peças a revisar no catálogo\n\n${secao("A. Impacto provado, muda só com ação do jogador", soAcao)}${secao("B. Impacto provado, muda também com o personagem parado", tambem)}${secao("C. Impacto provado, não mudou nas ações do roteiro", semMudar)}`);
