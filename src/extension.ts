// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { homedir } from "os";
import * as path from "path";
import * as vscode from "vscode";

import {
  backupKeybindingFile,
  collectBackupFiles,
  deleteAllBackupFiles,
  restoreKeybindingBackup,
} from "./backupKeybinding";
import {
  getCommandsToPreserveKeybinding,
  getExtensionsToPreserveKeybinding,
} from "./config";
import { openAndGetGlobalKeybindingsUri } from "./customKeybinding";
import { disableDefaultKeybindings } from "./disableDefaultKeybinding";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const f = async () => {
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);
    const backupDir = path.join(
      context.globalStorageUri.fsPath,
      "keybindings_backup"
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "disable-default-keybinding.delete-all-backups",
        async () => {
          deleteAllBackupFiles(backupDir);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "disable-default-keybinding.restore-keybindings-backup",
        async () => {
          const globalKeybindingsUri = await openAndGetGlobalKeybindingsUri();
          if (!globalKeybindingsUri) {
            return;
          }
          const backups = await collectBackupFiles(backupDir);
          const backup = await vscode.window.showQuickPick(backups, {
            title: "Select version to restore",
          });
          if (backup) {
            await restoreKeybindingBackup(
              vscode.Uri.file(path.join(backupDir, backup)),
              globalKeybindingsUri,
              backupDir
            );
          }
        }
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "disable-default-keybinding.disable-default-keybindings",
        async () => {
          const globalKeybindingsUri = await openAndGetGlobalKeybindingsUri();
          if (!globalKeybindingsUri) {
            return;
          }
          await backupKeybindingFile(globalKeybindingsUri, backupDir);
          await disableDefaultKeybindings(
            globalKeybindingsUri,
            getExtensionsToPreserveKeybinding(),
            getCommandsToPreserveKeybinding()
          );
        }
      )
    );
  };
  f();
}

// This method is called when your extension is deactivated
export function deactivate() {}
