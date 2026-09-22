/**
 * Ensure SandustryTypes/ exists before npm links file:SandustryTypes.
 * Used by package.json preinstall.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTypesRepo } from "../lib/types-repo.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

ensureTypesRepo(ROOT);
