// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { deleteAllBackupFiles, selectAndRestoreBackup } from "./backup";
import { getRunOnChange, SECTION } from "./config";
import {
  confirmAndDisableDefaultKeybindings,
  disableDefaultKeybindingsIfChanged,
} from "./disableKeybinding";
import { Config, setup } from "./setup";

export const EXTENSION_NAME = "disable-default-keybinding";
export const COMMAND_DISABLE_KEYBINDINGS = `${EXTENSION_NAME}.disable-default-keybindings`;
export const COMMAND_RESTORE_BACKUP = `${EXTENSION_NAME}.restore-keybindings-backup`;
export const COMMAND_DELETE_BACKUP = `${EXTENSION_NAME}.delete-all-backups`;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const configFuture = setup(context);

  const registerCommand = (
    command: string,
    func: (config: Config) => Promise<void>
  ) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, async () => {
        const config = await configFuture;
        await func(config);
      })
    );
  };

  registerCommand(COMMAND_DELETE_BACKUP, async (config: Config) => {
    await deleteAllBackupFiles(config.backupDir);
  });

  registerCommand(COMMAND_RESTORE_BACKUP, async (config: Config) => {
    await selectAndRestoreBackup(config.backupDir);
  });

  registerCommand(COMMAND_DISABLE_KEYBINDINGS, async (config: Config) => {
    await confirmAndDisableDefaultKeybindings(config.backupDir);
  });

  let extensionOnChangeDisposable: vscode.Disposable | undefined = undefined;
  const registerOrDisposeExtensionOnChangeCallback = async () => {
    if (getRunOnChange()) {
      if (extensionOnChangeDisposable === undefined) {
        extensionOnChangeDisposable = vscode.extensions.onDidChange(
          async () => {
            const config = await configFuture;
            await disableDefaultKeybindingsIfChanged(config.backupDir);
          }
        );
        context.subscriptions.push(extensionOnChangeDisposable);
      }
    } else {
      if (extensionOnChangeDisposable !== undefined) {
        extensionOnChangeDisposable.dispose();
        extensionOnChangeDisposable = undefined;
      }
    }
  };
  vscode.workspace.onDidChangeConfiguration(async (change) => {
    if (change.affectsConfiguration(SECTION)) {
      await registerOrDisposeExtensionOnChangeCallback();
    }
  });
  registerOrDisposeExtensionOnChangeCallback();
  if (getRunOnChange()) {
    configFuture.then((config) => {
      disableDefaultKeybindingsIfChanged(config.backupDir);
    });
  }
  return configFuture;
}

// This method is called when your extension is deactivated
export function deactivate() {}
