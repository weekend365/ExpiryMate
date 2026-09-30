import fs from "node:fs";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../../design/backgrounds/shopping-preparation-v1.png", import.meta.url));
const destination = fileURLToPath(new URL("../assets/backgrounds/shopping-preparation-bg.png", import.meta.url));
const original = fs.readFileSync(source);

if (process.argv.includes("--check")) {
  if (!fs.existsSync(destination) || !original.equals(fs.readFileSync(destination))) {
    throw new Error("Shopping background is out of sync. Run backgrounds:sync.");
  }
  console.log("Shopping background matches its source artwork.");
} else {
  fs.writeFileSync(destination, original);
  console.log("Synced shopping background from its source artwork.");
}
