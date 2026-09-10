import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: "charts",
              test: /node_modules[\\/](recharts|d3-[^/\\]+|victory-vendor)[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
});
