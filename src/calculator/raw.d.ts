// Vite's `?raw` imports: the text of a file, as a string.
declare module "*?raw" {
  const text: string;
  export = text;
}
