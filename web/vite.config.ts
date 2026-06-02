import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png"],
      manifest: {
        name: "EvenSteven",
        short_name: "EvenSteven",
        description: "Dziel koszty wyjazdu po równo (albo i nie)",
        theme_color: "#3AA6D0",
        background_color: "#f5f9fb",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // W dev przepuszczamy /api na backend Fastify -> wygląda jak same-origin,
    // więc httpOnly cookie z sesją chodzi bez kombinowania z CORS.
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
