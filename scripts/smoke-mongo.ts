/**
 * Smoke-check Mongo from local env. Never prints credentials or full URI.
 * Usage: npx tsx scripts/smoke-mongo.ts
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

function redactHost(uri: string): string {
  try {
    const u = new URL(uri);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "(unparseable-uri)";
  }
}

async function main() {
  const uri = (process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("FAIL: MONGODB_URI unset");
    process.exit(1);
  }

  const hostPath = redactHost(uri);
  console.log(`Connecting to ${hostPath} (credentials redacted)…`);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
    const dbName = mongoose.connection.name || "(none)";
    await mongoose.connection.db?.admin().command({ ping: 1 });
    console.log(`OK: Mongo connected; database=${dbName}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Strip any accidental credential-looking substrings from driver errors.
    const safe = msg.replace(/\/\/[^@\s]+@/g, "//***@");
    console.error(`FAIL: Mongo connect error: ${safe}`);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(2);
  }
}

main();
