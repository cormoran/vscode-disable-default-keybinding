import * as vscode from "vscode";
import * as path from "path";

export async function backupKeybindingFile(
    keybindingsUri: vscode.Uri,
    backupDir: string,
    timestamp = new Date(),
  ): Promise<vscode.Uri> {
    // create backup under ~/.vscode/keybinginds_backup
    const backupFile = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}--${timestamp.getHours()}-${timestamp.getMinutes()}-${timestamp.getSeconds()}_keybindings.json`;
    vscode.workspace.fs.createDirectory(vscode.Uri.file(backupDir));
    const target = vscode.Uri.file(path.join(backupDir, backupFile));
    await vscode.workspace.fs.copy(keybindingsUri, target, { overwrite: false });
    return target;
  }
  
  export async function restoreKeybindingBackup(
    backupUri: vscode.Uri,
    keybindingsUri: vscode.Uri,
    backupDir: string,
  ) {
    const newBackup = await backupKeybindingFile(keybindingsUri, backupDir);
    await vscode.workspace.fs.copy(backupUri, keybindingsUri, {
      overwrite: true,
    });
    vscode.window.showInformationMessage(
      `Backup ${backupUri.fsPath} was restored. Existing keybinding was backed-up to ${newBackup.fsPath}.`
    );
  }
  
  export async function collectBackupFiles(backupDir: string) {
    return await vscode.workspace.fs
          .readDirectory(vscode.Uri.file(backupDir))
          .then((items) =>
            items
              .filter(
                (item) =>
                  item[1] == vscode.FileType.File &&
                  item[0].endsWith("_keybindings.json")
              )
              .map((item) => item[0])
          );
  }

  export async function deleteAllBackupFiles(backupDir: string) {
        const backups = await collectBackupFiles(backupDir)
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