import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getOpenApiDocument } from "../openapi";

const target = resolve(process.cwd(), "../../docs/openapi.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(getOpenApiDocument(), null, 2)}\n`);
process.stdout.write(`Wrote ${target}\n`);
