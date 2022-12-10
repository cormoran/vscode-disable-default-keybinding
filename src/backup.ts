import * as vscode from "vscode";
import * as path from "path";
import { openAndGetGlobalKeybindingsUri } from "./customKeybinding";
import * as fs from "fs";

export const BACKUP_FILE_SUFFIX = "_keybindings.json";

/**
 * Create copy of specified keybindingsUri (keybindings.json) under the given backupDir.
 * The file name is like 2022-12-10--20-26-30_keybindings.json, depending on the given timestamp.
 * @param keybindingsUri
 * @param backupDir
 * @param timestamp
 * @returns Promise which produces newly created backup file.
 */
export async function backupKeybindingFile(
  keybindingsUri: vscode.Uri,
  backupDir: string,
  timestamp = new Date()
): Promise<vscode.Uri> {
  const y = timestamp.getFullYear(),
    m = timestamp.getMonth(),
    d = timestamp.getDate(),
    h = timestamp.getHours(),
    min = timestamp.getMinutes(),
    s = timestamp.getSeconds();
  let backupFile: string | undefined = undefined;
  for (let i = 0; i < 100; i++) {
    backupFile = `${y}-${m}-${d}--${h}-${min}-${s}-${i}${BACKUP_FILE_SUFFIX}`;
    if (!fs.existsSync(path.join(backupDir, backupFile))) {
      break;
    }
  }
  if (!backupFile) {
    throw new Error(
      "Failed to create backup file due to too many backup within 1 sec"
    );
  }
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(backupDir));
  const target = vscode.Uri.file(path.join(backupDir, backupFile));
  await vscode.workspace.fs.copy(keybindingsUri, target, { overwrite: false });
  return target;
}

/**
 * Overwrite existing keybindingsUri (keybindings.json) with given backup file.
 * It creates new backup under backupDir before restoring.
 * @param backupUri
 * @param keybindingsUri
 * @param backupDir
 * @returns Promise which produces newly created backup file.
 */
export async function restoreKeybindingBackup(
  backupUri: vscode.Uri,
  keybindingsUri: vscode.Uri,
  backupDir: string
): Promise<vscode.Uri> {
  const newBackup = await backupKeybindingFile(keybindingsUri, backupDir);
  await vscode.workspace.fs.copy(backupUri, keybindingsUri, {
    overwrite: true,
  });
  return newBackup;
}

/**
 * Find backup files which was created by this extension under backupDir
 * @returns list of backup files
 */
export async function collectBackupFiles(backupDir: string) {
  return await vscode.workspace.fs
    .readDirectory(vscode.Uri.file(backupDir))
    .then((items) =>
      items
        .filter(
          (item) =>
            item[1] === vscode.FileType.File &&
            item[0].endsWith(BACKUP_FILE_SUFFIX)
        )
        .map((item) => item[0])
    );
}

//
// methods linked to vscode commands
//

export async function deleteAllBackupFiles(backupDir: string) {
  const backups = await collectBackupFiles(backupDir);
  if (backups.length === 0) {
    vscode.window.showInformationMessage("No backups found");
    return;
  }
  const answer = await vscode.window.showQuickPick(["Cancel", "Yes"], {
    title: `Do you want to delete ${backups.length} keybindings.json backups taken by this extension?`,
  });
  if (answer === "Yes") {
    backups.forEach((backup) => {
      vscode.workspace.fs.delete(
        vscode.Uri.file(path.join(backupDir, backup)),
        { useTrash: true }
      );
    });
  }
}

export async function selectAndRestoreBackup(backupDir: string) {
  const globalKeybindingsUri = await openAndGetGlobalKeybindingsUri();
  if (!globalKeybindingsUri) {
    return;
  }
  const backups = await collectBackupFiles(backupDir);
  if (backups.length === 0) {
    vscode.window.showInformationMessage(`No backup exits in ${backupDir}!`);
    return;
  }
  const backup = await vscode.window.showQuickPick(backups, {
    title: "Select backup to restore",
  });
  if (backup) {
    const newBackup = await restoreKeybindingBackup(
      vscode.Uri.file(path.join(backupDir, backup)),
      globalKeybindingsUri,
      backupDir
    );
    vscode.window.showInformationMessage(
      `Backup ${backup} was restored. Existing keybinding was backed-up to ${newBackup.fsPath}.`
    );
  }
  // noop
}
