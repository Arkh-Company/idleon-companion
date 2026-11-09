// Disposable prototype: not product code.
// Etapa 3 do catalogo: altera uma peca por vez num retrato real, recalcula e anota quais numeros mudaram.
// Grava so fora do repositorio; nada de valor sai na tela. Uso: node impacto.cjs <parado|trocado> [limite]
"use strict";
const fs = require("node:fs");
const { liga, carrega, numeros, preguicosas, RETRATOS, SAIDA } = require("./vivo.cjs");

const ESTADO = process.argv[2] || "parado";
const LIMITE = Number(process.argv[3] || 1e9);
const arquivos = fs.readdirSync(RETRATOS).filter((f) => f.endsWith(".json")).sort();
// parado: o fim do roteiro. trocado: o ultimo retrato antes de colocar o item de volta, com o item fora.
const arquivo = ESTADO === "parado" ? arquivos[arquivos.length - 1] : arquivos.filter((f) => f < "161805").pop();
const retrato = JSON.parse(fs.readFileSync(`${RETRATOS}/${arquivo}`, "utf8"));
const saida = `${SAIDA}/impacto-${ESTADO}.jsonl`;
// "texto": segunda passada, acrescenta so as pecas com texto que ainda nao mostraram impacto.
const SO_TEXTO = process.argv[4] === "texto";
const jaProvadas = new Set();
if (SO_TEXTO) for (const l of fs.readFileSync(saida, "utf8").split("\n").filter(Boolean)) { const x = JSON.parse(l); if (x.numeros.length) jaProvadas.add(x.peca); }
else fs.writeFileSync(saida, "");

const NUM = /^-?\d+(\.\d+)?$/;
function muda(v, n, s) {
  if (typeof v === "number") return n(v);
  if (typeof v === "string") return s(v);
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => muda(x, n, s));
  if ("$n" in v || "$x" in v) return v;
  if ("$m" in v) return { ...v, $m: Object.fromEntries(Object.entries(v.$m).map(([k, x]) => [k, muda(x, n, s)])) };
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, muda(x, n, s)]));
}
function inverte(v) {
  if (Array.isArray(v)) return v.map(inverte).reverse();
  if (typeof v === "string") return NUM.test(v) ? v : `${v}x`;
  if (typeof v === "number") return v + 1;
  if (v && typeof v === "object" && "$m" in v) {
    const k = Object.keys(v.$m);
    const a = k.map((x) => inverte(v.$m[x])).reverse();
    return { ...v, $m: Object.fromEntries(k.map((x, i) => [x, a[i]])) };
  }
  return v;
}
const reordena = (v) => {
  if (Array.isArray(v)) return v.map(reordena).reverse();
  if (v && typeof v === "object" && "$m" in v) {
    const k = Object.keys(v.$m);
    const a = k.map((x) => reordena(v.$m[x])).reverse();
    return { ...v, $m: Object.fromEntries(k.map((x, i) => [x, a[i]])) };
  }
  return v;
};
const ALTERACOES = SO_TEXTO
  ? [
      // Nomes validos em outra ordem, e o vazio que o jogo usa quando tira um item.
      ["reordena", reordena],
      ["vazio", (v) => muda(v, (x) => x, (s) => (NUM.test(s) ? s : "Blank"))],
    ]
  : [
      ["dobra", (v) => muda(v, (x) => x * 2 + 1, (s) => (NUM.test(s) ? String(Number(s) * 2 + 1) : s))],
      ["zera", (v) => muda(v, () => 0, (s) => (NUM.test(s) ? "0" : s))],
      ["inverte", inverte],
    ];
const temTexto = (v) => /"(?!\$[mcnx]")[^"]*[^"\d.\-][^"]*"(?!:)/.test(JSON.stringify(v) ?? "");

const a = retrato.attrs;
const atual = a.UserInfo[0];
const outros = Object.keys(a.PlayerDATABASE.$m).filter((n) => n !== atual);
const subs = (lista) => [...new Set(lista.flatMap((n) => Object.keys(a.PlayerDATABASE.$m[n].$m)))];

// Cada peca: nome no catalogo, como ler o valor e como gravar outro (undefined apaga).
const pecas = [];
const peca = (nome, ler, gravar) => pecas.push({ nome, ler, gravar });
const nomeia = (o, k, v) => (v === undefined ? delete o[k] : (o[k] = v));
for (const k of Object.keys(a)) if (k !== "DNSM" && k !== "PlayerDATABASE") peca(k, () => a[k], (v) => nomeia(a, k, v));
for (const k of Object.keys(a.DNSM.$m)) peca(`DNSM.${k}`, () => a.DNSM.$m[k], (v) => nomeia(a.DNSM.$m, k, v));
const db = a.PlayerDATABASE.$m;
for (const k of Object.keys(db[atual].$m)) peca(`Personagem.${k}`, () => db[atual].$m[k], (v) => nomeia(db[atual].$m, k, v));
for (const k of subs(outros)) {
  const tem = outros.filter((n) => k in db[n].$m);
  peca(`OutrosPersonagens.${k}`, () => tem.map((n) => db[n].$m[k]), (v) => tem.forEach((n, i) => nomeia(db[n].$m, k, v && v[i])));
}
for (const k of Object.keys(retrato.vars || {})) peca(`_vars.${k}`, () => retrato.vars[k], (v) => nomeia(retrato.vars, k, v));

let m;
function novo() {
  m = liga();
  carrega(m, JSON.stringify(retrato));
}
function calcula() {
  m.sandbox.__mosaic = JSON.stringify(retrato);
  m.run(`__calc.recarrega("v3",${preguicosas})`, 10000);
  return numeros(m, "uma");
}
novo();
const zero = liga();
carrega(zero, JSON.stringify(retrato));
const base = numeros(zero, "cada");
const iguais = (x) => Object.keys(base).every((k) => base[k] === x[k]);
if (!iguais(calcula())) throw new Error("o contexto vivo nao bate com o calculo do zero");

let derivas = 0, feitas = 0;
const refeitas = new Set();
let verificado = 0;
const lista = (SO_TEXTO ? pecas.filter((p) => !jaProvadas.has(p.nome) && temTexto(p.ler())) : pecas).slice(0, LIMITE);
for (let i = 0; i < lista.length; i++) {
  const p = lista[i];
  const original = p.ler();
  const texto = JSON.stringify(original);
  const linha = { peca: p.nome, tamanho: texto ? texto.length : 0, alteracao: null, numeros: [], quebrou: [] };
  const testa = (nome) => {
    let n;
    try {
      n = calcula();
    } catch {
      linha.quebrou.push("todos");
      novo();
      return false;
    }
    const dif = Object.keys(base).filter((k) => base[k] !== n[k]);
    const valores = dif.filter((k) => n[k] !== null);
    linha.quebrou.push(...dif.filter((k) => n[k] === null));
    if (valores.length) {
      linha.alteracao = nome;
      linha.numeros = valores;
      return true;
    }
    return false;
  };
  let alterou = false;
  for (const [nome, f] of ALTERACOES) {
    const novoValor = f(original);
    if (JSON.stringify(novoValor) === texto) continue;
    alterou = true;
    p.gravar(novoValor);
    const achou = testa(nome);
    p.gravar(JSON.parse(texto));
    if (achou) break;
  }
  if (!alterou && texto !== undefined && !SO_TEXTO) {
    p.gravar(undefined);
    testa("remove");
    p.gravar(JSON.parse(texto));
  }
  linha.quebrou = [...new Set(linha.quebrou)];
  linha.alterou = alterou;
  fs.appendFileSync(saida, `${JSON.stringify(linha)}\n`);
  feitas++;
  // De tempos em tempos confere se o contexto vivo continua batendo; se nao, refaz o trecho num contexto novo.
  if ((i + 1) % 25 === 0) {
    if (!iguais(calcula())) {
      derivas++;
      novo();
      if (!refeitas.has(i)) {
        refeitas.add(i);
        i = verificado - 1;
        continue;
      }
    }
    verificado = i + 1;
    console.log(ESTADO, i + 1, "de", lista.length, "derivas", derivas);
  }
}
console.log(`FIM ${ESTADO}: ${feitas} testes de ${lista.length} pecas, derivas ${derivas}, arquivo ${arquivo}`);
