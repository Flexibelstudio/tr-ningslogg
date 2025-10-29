import path from "path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

// Exportera en funktion i stället för defineConfig
export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, ".", ""); // läser .env.production vid build
  return {
    server: { host: "0.0.0.0", port: 3000 },
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, ".") } },

    // Viktigt: exponera VITE_* till klientkoden
    envPrefix: ["VITE_"],

    // (om du läser process.env.GEMINI_API_KEY i klientkod)
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY ?? ""),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY ?? ""),
    },
  };
};
