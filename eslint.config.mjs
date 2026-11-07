// Com TS 7, instale o TS 6 lado a lado (alias `typescript` -> @typescript/typescript6) até a 7.1 expor API.
// Rodado por `just lint` sem --max-warnings=0: aviso aparece, mas não reprova o `just check`.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Fora do ESLint: hooks e skills do Claude (Node puro, testados à parte), o Spec Kit e as specs com os protótipos,
  // a saída do electron-vite (o ESLint 10 não lê o .gitignore) e o jogo falso dos testes (código de navegador que imita o jogo)
  {
    ignores: [
      "dist/**",
      "out/**",
      "src/keeper/mock-game/**",
      "coverage/**",
      "**/*.generated.*",
      ".claude/**",
      ".specify/**",
      "specs/**",
    ],
  },
  {
    // Supressões honestas: diretiva que não suprime nada vira erro
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      // import.meta.dirname: Node >= 20.11
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Já vêm nos presets; explícitos para documentar a política
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
      // Grep-ability: exports nomeados; a mensagem já diz o que fazer
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "Use export nomeado (ex.: `export function createInvoice`); facilita grep e refactor.",
        },
      ],
      // Tamanho: aviso cedo, sem travar o agente no meio de um refactor
      "max-lines": [
        "warn",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
  },
  {
    // vite/vitest/playwright exigem default export
    files: ["*.config.{ts,mts,js,mjs}"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
