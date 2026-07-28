/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig({
  test: {
    env: loadEnv("test", process.cwd(), ""),
    exclude: ["**/node_modules/**", "**/dist/**", "./temp/**", "tsconfig.json"],
  },
});
