import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { discoveryPlugin } from "./server/discoveryPlugin";
export default defineConfig({
    define: {
        global: "globalThis"
    },
    optimizeDeps: {
        esbuildOptions: {
            define: {
                global: "globalThis"
            }
        }
    },
    plugins: [react(), discoveryPlugin()],
    server: {
        port: 5174,
        host: true
    }
});
