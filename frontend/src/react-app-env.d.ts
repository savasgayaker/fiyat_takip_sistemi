/// <reference types="react-scripts" />

declare module "*.css";

declare module "katex" {
  const katex: {
    renderToString: (tex: string, options?: Record<string, unknown>) => string;
  };
  export default katex;
}
