import path = require("path");
import * as vscode from "vscode";

export interface Config {
  backupDir: string;
}

export async function setup(context: vscode.ExtensionContext): Promise<Config> {
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  const backupDir = path.join(
    context.globalStorageUri.fsPath,
    "keybindings_backup"
  );
  vscode.window.showInformationMessage("setup finished!");
  return {
    backupDir: backupDir,
  };
}
