// A forma dos tokens da Anthropic (sk-ant-oat01-…, sk-ant-api03-…), numa expressão só para o workflow semanal: a
// usam o skills-analise.mjs (antes do upload do artifact analise) e o conferir-base.mjs (antes do PR). Quem a usa
// nunca imprime o texto casado.
export const TOKEN = /sk-ant-[A-Za-z0-9_-]{20,}/;
