// Disposable prototype: not product code.
// Pergunta: dá para tirar mapas, monstros e números de tela do N.js instalado lendo só como texto?
// O arquivo nunca é executado: tudo aqui é expressão regular sobre uma string. Nenhum trecho do jogo entra no repositório.

export interface Tabelas {
  /** Nome por número de mapa; null = não consegui ler. */
  mapas: string[] | null;
  /** Nome por id de monstro; null = não consegui ler. */
  monstros: Map<string, string> | null;
}

/** Uma lista "A B C".split(" ") atribuída a `.nome=function(){return ...}`; o nome do objeto muda a cada build. */
function lista(code: string, nome: string): string[] | null {
  const re = new RegExp(
    `\\.${nome}=function\\(\\)\\{return"([^"]*)"\\.split\\(" "\\)\\}`,
    "g",
  );
  const achados = [...code.matchAll(re)];
  if (achados.length !== 1) return null; // nenhum, ou mais de um: não adivinho qual é
  const itens = (achados[0]?.[1] ?? "").split(" ");
  return itens.length > 1 && itens.every((i) => i !== "") ? itens : null;
}

export function lerMapas(code: string): string[] | null {
  const nomes = lista(code, "MapDispName");
  const ids = lista(code, "MapName");
  // As duas listas andam juntas no jogo: tamanhos diferentes são sinal de formato novo.
  return nomes && ids && nomes.length === ids.length
    ? nomes.map((n) => n.replaceAll("_", " "))
    : null;
}

export function lerMonstros(code: string): Map<string, string> | null {
  const chamadas = [...code.matchAll(/\.addNewMonster\("([^"]+)",/g)];
  if (chamadas.length === 0) return null;
  const monstros = new Map<string, string>();
  for (const c of chamadas) {
    const id = c[1] ?? "";
    // O nome é o primeiro campo do objeto, logo depois da abertura.
    const resto = code.slice(c.index + c[0].length, c.index + c[0].length + 200);
    const nome = /^\s*\{\s*Name:\s*"([^"]+)"/.exec(resto)?.[1];
    if (nome === undefined) return null; // tudo ou nada: nunca uma tabela pela metade
    monstros.set(id, nome.replaceAll("_", " ")); // id repetido: o último vale, como no addNewMonster do jogo
  }
  return monstros;
}

export function lerTabelas(code: string): Tabelas {
  return { mapas: lerMapas(code), monstros: lerMonstros(code) };
}

/** Os números de janela escritos ou comparados como literais. Os botões do Menu (8 a 13) saem de uma conta e já estão no catálogo. */
export function numerosDeTela(code: string): Set<number> {
  const num = String.raw`(-?\d+(?:\.\d+)?)`;
  const formas = [
    new RegExp(String.raw`\.h\.MenuType2\s*=\s*${num}(?![\d.])`, "g"),
    new RegExp(String.raw`${num}\s*==\s*[\w.$]*getGameAttribute\("MenuType2"\)`, "g"),
  ];
  const achados = new Set<number>();
  for (const re of formas) for (const m of code.matchAll(re)) achados.add(Number(m[1]));
  return achados;
}

/** Só com um caminho na linha de comando: lê o app.asar instalado e imprime contagens. */
async function principal(asar: string, doc: string | undefined) {
  const { openSync, readSync, closeSync, readFileSync } = await import("node:fs");
  const t0 = performance.now();
  const fd = openSync(asar, "r");
  const ler = (pos: number, n: number) => {
    const b = Buffer.alloc(n);
    readSync(fd, b, 0, n, pos);
    return b;
  };
  const cab = ler(0, 16);
  type No = { files?: Record<string, No>; offset?: string; size?: number };
  let no = JSON.parse(ler(16, cab.readUInt32LE(12)).toString("utf8")) as No;
  for (const p of ["distBuild", "static", "game", "N.js"]) no = no.files?.[p] as No;
  const code = ler(8 + cab.readUInt32LE(4) + Number(no.offset), no.size ?? 0).toString("utf8");
  closeSync(fd);
  const t1 = performance.now();
  const { mapas, monstros } = lerTabelas(code);
  const t2 = performance.now();
  const telas = numerosDeTela(code);
  const t3 = performance.now();

  const afk = new Set([...code.matchAll(/\.AFKtarget="([^"]+)"/g)].map((m) => m[1] ?? ""));
  console.log({
    caracteres: code.length,
    mapas: mapas?.length ?? null,
    monstros: monstros?.size ?? null,
    monstrosSemNome: monstros ? [...monstros.values()].filter((n) => n === "").length : null,
    adicaoGuardaPorId: /\.addNewMonster=function\(e,t\)\{.{0,4000}?monsterDefs\.h\[e\]=/.test(code),
    idsAfkNoCodigo: afk.size,
    idsAfkForaDaTabela: [...afk].filter((i) => !monstros?.has(i) && i !== "Nothing").length,
    numerosDeTela: telas.size,
    msLeitura: Math.round(t1 - t0),
    msTabelas: Math.round(t2 - t1),
    msNumeros: Math.round(t3 - t2),
  });

  if (doc) {
    const linhas = readFileSync(doc, "utf8").split("\n");
    const ini = linhas.findIndex((l) => l.startsWith("### Mapa 2"));
    const fim = linhas.findIndex((l, i) => i > ini && l.startsWith("## "));
    const doMapa = new Set<number>();
    for (const l of linhas.slice(ini, fim === -1 ? undefined : fim)) {
      const m = /^\| (\d+) \|/.exec(l);
      if (m) doMapa.add(Number(m[1]));
    }
    const ordem = (s: Iterable<number>) => [...s].sort((a, b) => a - b);
    console.log({
      numerosNoMapaDeTelas: doMapa.size,
      noMapaMasNaoNoCodigo: ordem([...doMapa].filter((n) => !telas.has(n))),
      noCodigoMasNaoNoMapa: ordem([...telas].filter((n) => !doMapa.has(n))),
    });
  }
}

if (process.argv[1]?.endsWith("extrair.ts") && process.argv[2])
  await principal(process.argv[2], process.argv[3]);
