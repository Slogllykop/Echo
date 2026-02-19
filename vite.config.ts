import { readFileSync } from "node:fs";
import path from "node:path";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const manifest = JSON.parse(readFileSync(path.resolve(__dirname, "manifest.json"), "utf-8"));

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), crx({ manifest })],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
