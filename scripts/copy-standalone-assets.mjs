import { cpSync, existsSync, mkdirSync } from "node:fs";

const standaloneDir = ".next/standalone";

if (existsSync(standaloneDir)) {
  mkdirSync(`${standaloneDir}/.next`, { recursive: true });

  if (existsSync(".next/static")) {
    cpSync(".next/static", `${standaloneDir}/.next/static`, { recursive: true });
  }

  if (existsSync("public")) {
    cpSync("public", `${standaloneDir}/public`, { recursive: true });
  }
}
