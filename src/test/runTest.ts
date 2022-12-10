import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} from "@vscode/test-electron";
import { spawnSync } from "child_process";

async function main() {
  // workaround for https://github.com/microsoft/vscode/issues/86382
  const userDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "vscode-ddk-test-user-data")
  );
  console.log(userDir);
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    const vscodeExecutablePath = await downloadAndUnzipVSCode();

    const [cli, ...args] =
      resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
    spawnSync(cli, [...args, "--install-extension", "ms-python.python"], {
      encoding: "utf-8",
      stdio: "inherit",
    });

    // run test without other extensions
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ["--disable-extensions", "--user-data-dir", userDir],
    });

    // run test with python extension
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: { withPythonExtension: "true" },
      launchArgs: ["--user-data-dir", userDir],
    });
  } catch (err) {
    console.error(err);
    console.error("Failed to run tests");
    fs.rmSync(userDir, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(userDir, { recursive: true, force: true });
}

main();
