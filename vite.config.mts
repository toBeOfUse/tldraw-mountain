import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { defineConfig, Plugin } from "vite";

// https://stackoverflow.com/a/78012267/3962267
const base64Loader: Plugin = {
  name: "base64-loader",
  transform(_: any, id: string) {
    const [path, query] = id.split("?");
    if (query != "base64") return null;

    const data = fs.readFileSync(path);
    const base64 = data.toString("base64");

    return `export default '${base64}';`;
  },
};

export default defineConfig(() => ({
  plugins: [react({ tsDecorators: true }), base64Loader],
  root: path.join(__dirname, "src/client"),
  publicDir: path.join(__dirname, "src/client/public"),
  server: {
    port: 5757,
  },
  optimizeDeps: {
    exclude: ["@tldraw/assets"],
  },
  build: {
    // don't inline svgs! it messes up css urls
    assetsInlineLimit: 0,
  },
}));
