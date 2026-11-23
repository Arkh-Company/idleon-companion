// Vite's `import.meta.glob`, eager with the default export (spec 010, research R8: the blueprints inside calculator.js).
interface ImportMeta {
  glob<T>(
    pattern: string,
    options: { eager: true; import: "default" },
  ): Record<string, T>;
}
