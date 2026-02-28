const fs = require("fs");
const path = require("path");

const localesDir = path.join(__dirname, "..", "public", "locales");
const baseLocale = "en";

function loadJson(locale) {
  const filePath = path.join(localesDir, locale, "translation.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function flattenKeys(obj, prefix = "") {
  const keys = new Set();
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenKeys(value, next).forEach((k) => keys.add(k));
    } else {
      keys.add(next);
    }
  });
  return keys;
}

function diffKeys(baseKeys, targetKeys) {
  const missing = [];
  const extra = [];
  baseKeys.forEach((key) => {
    if (!targetKeys.has(key)) missing.push(key);
  });
  targetKeys.forEach((key) => {
    if (!baseKeys.has(key)) extra.push(key);
  });
  return { missing, extra };
}

const locales = fs
  .readdirSync(localesDir)
  .filter((entry) => fs.statSync(path.join(localesDir, entry)).isDirectory());

if (!locales.includes(baseLocale)) {
  console.error(`Base locale '${baseLocale}' not found in ${localesDir}`);
  process.exit(1);
}

const baseKeys = flattenKeys(loadJson(baseLocale));
let hasErrors = false;

locales
  .filter((locale) => locale !== baseLocale)
  .forEach((locale) => {
    const targetKeys = flattenKeys(loadJson(locale));
    const { missing, extra } = diffKeys(baseKeys, targetKeys);

    if (missing.length || extra.length) {
      hasErrors = true;
      console.error(`\nLocale '${locale}' has key mismatches:`);
      if (missing.length) {
        console.error(`  Missing (${missing.length}):`);
        missing.sort().forEach((k) => console.error(`    - ${k}`));
      }
      if (extra.length) {
        console.error(`  Extra (${extra.length}):`);
        extra.sort().forEach((k) => console.error(`    - ${k}`));
      }
    }
  });

if (hasErrors) {
  console.error("\nTranslation check failed.");
  process.exit(1);
}

console.log("All locales match base keys.");
