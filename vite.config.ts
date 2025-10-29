import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: { port: 3000, host: "0.0.0.0" },
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, ".") } },

    // 👇 denna rad gör att alla variabler som börjar med VITE_ inkluderas i bundlen
    envPrefix: ["VITE_"],

    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
  };
});
