// Disposable prototype: not product code. Todo o "código de jogo" aqui é inventado (FR-015).
import { describe, expect, it } from "vitest";
import { lerMapas, lerMonstros, lerTabelas, numerosDeTela } from "./extrair.ts";

const mapas = (nomes: string, ids: string) =>
  `x.MapName=function(){return"${ids}".split(" ")},x.MapDispName=function(){return"${nomes}".split(" ")};`;
const monstro = (id: string, nome: string) =>
  `G.addNewMonster("${id}",{Name:"${nome}",AFKtype:"X"});`;

describe("tabelas lidas como texto", () => {
  it("lê mapas, com espaço no lugar do sublinhado", () => {
    expect(lerMapas(mapas("Vale_Azul Pico", "vale pico"))).toEqual(["Vale Azul", "Pico"]);
  });

  it("lê monstros por id", () => {
    const code = monstro("a1", "Bicho_Um") + monstro("b2", "Bicho");
    expect(lerMonstros(code)).toEqual(
      new Map([
        ["a1", "Bicho Um"],
        ["b2", "Bicho"],
      ]),
    );
  });

  it("formato novo vira 'não consegui ler', nunca nome errado", () => {
    expect(lerTabelas("var a=1;")).toEqual({ mapas: null, monstros: null });
    expect(lerMapas('x.MapDispName=["Vale","Pico"];')).toBeNull();
    expect(lerMapas(mapas("Vale Pico", "so_um"))).toBeNull(); // listas de tamanhos diferentes
    expect(lerMapas(mapas("Vale Pico", "a b") + mapas("Outro Mais", "c d"))).toBeNull(); // duas candidatas
    // Um monstro fora do formato derruba a tabela inteira.
    expect(lerMonstros(monstro("a1", "Bicho") + 'G.addNewMonster("b2",{Type:"X",Nome:"Y"});')).toBeNull();
  });

  it("id repetido: o último vale, como no jogo", () => {
    expect(lerMonstros(monstro("a1", "Bicho") + monstro("a1", "Outro"))?.get("a1")).toBe("Outro");
  });
});

describe("números de tela", () => {
  it("acha escritas e comparações", () => {
    const code = 'e.gameAttributes.h.MenuType2=7;if(99==a.engine.getGameAttribute("MenuType2")){};';
    expect([...numerosDeTela(code)].sort((a, b) => a - b)).toEqual([7, 99]);
  });

  it("ignora outros campos", () => {
    expect(numerosDeTela("e.h.MenuType=7;e.h.MenuType2TabSelected=3;").size).toBe(0);
  });
});
