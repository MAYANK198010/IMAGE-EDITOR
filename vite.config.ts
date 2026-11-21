import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites below /<repository-name>/.
// Local development and previews continue to use the root path.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/IMAGE-EDITOR/" : "/",
  plugins: [react()],
});
