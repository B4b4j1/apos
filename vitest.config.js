import { defineConfig } from "vitest/config";

// Les tests de l'app uniquement : build/ contient des clones tiers avec leurs propres tests.
export default defineConfig({
  test: {
    include: ["app/tests/**/*.test.js", "blocklist/**/*.test.js", "tools/**/*.test.js"],
    exclude: ["**/node_modules/**", "build/**"],
  },
});
