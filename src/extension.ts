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

export const EXTENSION_NAME = "disable-default-keybinding";
export const COMMAND_DISABLE_DEFAULT_KEYBINDINGS = `${EXTENSION_NAME}.disable-default-keybindings`;
export const COMMAND_RESTORE_BACKUP = `${EXTENSION_NAME}.restore-keybindings-backup`;
export const COMMAND_DELETE_BACKUP = `${EXTENSION_NAME}.delete-all-backups`;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const setup = async () => {
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);
    const backupDir = path.join(
      context.globalStorageUri.fsPath,
      "keybindings_backup"
    );
    vscode.window.showInformationMessage("setup finished!");
    return {
      backupDir: backupDir,
    };
  };
  const future = setup();
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DELETE_BACKUP, async () => {
      const setup = await future;
      deleteAllBackupFiles(setup.backupDir);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_RESTORE_BACKUP, async () => {
      const setup = await future;
      const globalKeybindingsUri = await openAndGetGlobalKeybindingsUri();
      if (!globalKeybindingsUri) {
        return;
      }
      const backups = await collectBackupFiles(setup.backupDir);
      const backup = await vscode.window.showQuickPick(backups, {
        title: "Select version to restore",
      });
      if (backup) {
        await restoreKeybindingBackup(
          vscode.Uri.file(path.join(setup.backupDir, backup)),
          globalKeybindingsUri,
          setup.backupDir
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMAND_DISABLE_DEFAULT_KEYBINDINGS,
      async () => {
        const setup = await future;
        const globalKeybindingsUri = await openAndGetGlobalKeybindingsUri();
        if (!globalKeybindingsUri) {
          return;
        }
        await backupKeybindingFile(globalKeybindingsUri, setup.backupDir);
        await disableDefaultKeybindings(
          globalKeybindingsUri,
          getExtensionsToPreserveKeybinding(),
          getCommandsToPreserveKeybinding()
        );
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
