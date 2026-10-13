
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

export default defineConfig({
    plugins: [react()],

    server: {
    host: "0.0.0.0",

    https: {
    cert: fs.readFileSync("./localhost+2.pem"),
    key: fs.readFileSync("./localhost+2-key.pem"),
    },
},
});