import { build } from "esbuild";

// Bundle kode sendiri (alias @/ ikut terselesaikan); dependency tetap di node_modules.
const common = { bundle: true, platform: "node", format: "esm", target: "node22", packages: "external", sourcemap: true, logLevel: "info" };

await build({ ...common, entryPoints: ["worker/index.ts"], outfile: "dist/worker.mjs" });
await build({ ...common, entryPoints: ["scripts/migrate.ts"], outfile: "dist/migrate.mjs" });
