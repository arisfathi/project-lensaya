import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendOrigin = (env.VITE_BACKEND_ORIGIN || "http://localhost:4000").replace(/\/+$/, "");

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, "/");
            if (!normalizedId.includes("/node_modules/")) return;

            const hasPackage = (pkgName) => normalizedId.includes(`/node_modules/${pkgName}/`);

            if (hasPackage("recharts")) return "vendor-charts";
            if (hasPackage("victory-vendor")) return "vendor-charts";
            if (hasPackage("@reduxjs/toolkit")) return "vendor-charts";
            if (hasPackage("react-redux")) return "vendor-charts";
            if (hasPackage("reselect")) return "vendor-charts";
            if (hasPackage("es-toolkit")) return "vendor-charts";
            if (hasPackage("immer")) return "vendor-charts";
            if (hasPackage("decimal.js-light")) return "vendor-charts";
            if (hasPackage("eventemitter3")) return "vendor-charts";
            if (hasPackage("tiny-invariant")) return "vendor-charts";
            if (hasPackage("use-sync-external-store")) return "vendor-charts";
            if (hasPackage("react-is")) return "vendor-charts";

            if (hasPackage("@emoji-mart/data")) return "vendor-emoji-data";
            if (hasPackage("@emoji-mart/react") || hasPackage("emoji-mart")) return "vendor-emoji-ui";
            if (hasPackage("react-phone-number-input") || hasPackage("libphonenumber-js")) return "vendor-phone";
            if (hasPackage("react-easy-crop")) return "vendor-crop";
            if (hasPackage("@aws-sdk")) return "vendor-aws";
            if (hasPackage("lucide-react")) return "vendor-icons";
            if (hasPackage("axios")) return "vendor-http";
            if (hasPackage("@react-oauth/google")) return "vendor-auth";
            if (hasPackage("framer-motion")) return "vendor-motion";
            if (hasPackage("swiper")) return "vendor-swiper";

            if (hasPackage("react-router") || hasPackage("react-router-dom") || hasPackage("@remix-run/router")) {
              return "vendor-router";
            }
            if (hasPackage("react") || hasPackage("react-dom") || hasPackage("scheduler")) return "vendor-react";

            return "vendor-core";
          },
        },
      },
    },
    server: {
      proxy: {
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
        },
        "/auth": {
          target: backendOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});
