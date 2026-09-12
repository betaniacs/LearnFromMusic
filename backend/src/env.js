import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Resolved relative to this file, not process.cwd(), so `npm start` from the
// repo root and `node src/server.js` from backend/ both work. __dirname does
// not exist in ES modules, hence import.meta.url.
const here = path.dirname(fileURLToPath(import.meta.url));

// backend/.env first, then the shared root .env. Real environment variables
// always win — dotenv never overwrites them, which is what makes this a no-op
// inside Docker, where compose injects the values directly.
dotenv.config({
  path: [path.join(here, "..", ".env"), path.join(here, "..", "..", ".env")],
  quiet: true,
});
