import { config } from "dotenv";

const envPaths = ["../../.env", "../../apps/web/.env", ".env"];

for (const path of envPaths) {
  config({ path, quiet: true });
}
