// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import siteConfig from "./site.config.ts";

export default defineConfig({
  site: siteConfig.seo.siteUrl,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
