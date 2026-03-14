import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runNodeScript = (scriptFileName) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptFileName);
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptFileName} exited with code ${code}`));
    });
  });

const main = async () => {
  console.log("[backup:daily] Starting daily backup workflow");
  await runNodeScript("backup-postgres.js");
  await runNodeScript("backup-r2-manifest.js");
  console.log("[backup:daily] Daily backup workflow completed");
};

main().catch((error) => {
  console.error(`[backup:daily] Failed: ${error.message}`);
  process.exitCode = 1;
});
