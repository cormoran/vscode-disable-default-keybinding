// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { homedir } from "os";
import { TextDecoder, TextEncoder } from "util";
import * as jsonc from "jsonc-parser";
interface Keybinding {
  key: String;
  command: String;
  extensionId: String;
}

const backupDir = path.join(homedir(), ".vscode", "keybindings_backup");

function collectKeybindings(): Array<Keybinding> {
  return vscode.extensions.all.flatMap((extension) =>
    ((extension.packageJSON.contributes?.keybindings as Array<any>) || [])
      .filter((keybinding) => keybinding != null)
      .map((keybinding) => {
        if ("command" in keybinding && "key" in keybinding) {
          const key: String = keybinding["key"];
          const command: String = keybinding["command"];
          return {
            key: key,
            command: command,
            extensionId: extension.id,
          } as Keybinding;
        } else {
          null;
        }
      })
      .filter((keybinding): keybinding is Keybinding => keybinding != null)
      .filter((keybinding) => keybinding.command.length > 0)
  );
}

function getValueFromBinding(
  node: jsonc.Node,
  key: string
): string | undefined {
  if (node.type === "object") {
    const prop = node.children?.find(
      (p) => p.type === "property" && p.children?.[0].value === key
    );
    return prop?.children?.[1].type === "string"
      ? prop?.children?.[1].value
      : undefined;
  }
  return undefined;
}

function isInsertedByThisExtension(node: jsonc.Node) {
  return (
    node.type === "object" &&
    getValueFromBinding(node, "key") !== undefined &&
    getValueFromBinding(node, "command") !== undefined &&
    getValueFromBinding(node, "extensionId") !== undefined &&
    getValueFromBinding(node, "note") !== undefined
  );
}

async function backupKeybindingFile(keybindingsUri: vscode.Uri): Promise<vscode.Uri> {
  // create backup under ~/.vscode/keybinginds_backup
  const now = new Date();
  const backupFile = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}--${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}_keybindings.json`;
  vscode.workspace.fs.createDirectory(vscode.Uri.file(backupDir));
  const target = vscode.Uri.file(path.join(backupDir, backupFile));
  await vscode.workspace.fs.copy(
    keybindingsUri,
    target,
    { overwrite: false }
  );
  return target;
}

async function restoreKeybindingBackup(backupUri: vscode.Uri, keybindingsUri: vscode.Uri) {
  const newBackup = await backupKeybindingFile(keybindingsUri);
  await vscode.workspace.fs.copy(
    backupUri,
    keybindingsUri,
    { overwrite: true }
  );
  vscode.window.showInformationMessage(`Backup ${backupUri.fsPath} was restored. Existing keybinding was backuped to ${newBackup.fsPath}.`);
}

async function getGlobalKeybindingsUri(): Promise<vscode.Uri | undefined> {
  await vscode.commands.executeCommand(
    "workbench.action.openGlobalKeybindingsFile"
  );
  const tabUris = vscode.window.tabGroups.all
    .flatMap((tagGroup) => tagGroup.tabs)
    .filter((tab) => tab.input && (tab.input as any).uri != null)
    .map((tab) => (tab.input as any).uri as vscode.Uri);
  const globalKeybindingsUri = tabUris.find(
    (uri) =>
      uri.scheme === "vscode-userdata" &&
      uri.path.endsWith("/keybindings.json")
  );
  return globalKeybindingsUri;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand(
    "disable-keyshortcut.restore-keybindings-backup",
    async () => {
      const globalKeybindingsUri = await getGlobalKeybindingsUri();
      if (!globalKeybindingsUri) {
        return;
      }
      const backups = await vscode.workspace.fs.readDirectory(vscode.Uri.file(backupDir))
      .then(items => items
        .filter(item => item[1] == vscode.FileType.File && item[0].endsWith("_keybindings.json"))
        .map(item => item[0])
      );
      const backup = await vscode.window.showQuickPick(backups, {
        title: "Select version to restore",
      });
      if (backup) {
        await restoreKeybindingBackup(vscode.Uri.file(backup), globalKeybindingsUri);
      }
  }));

  context.subscriptions.push(vscode.commands.registerCommand(
    "disable-keyshortcut.disable-extension-keybindings",
    async () => {
      const globalKeybindingsUri = await getGlobalKeybindingsUri();
      if (!globalKeybindingsUri) {
        return;
      }
      {
        // create backup under ~/.vscode/keybinginds_backup
        const now = new Date();
        const backupDir = path.join(homedir(), ".vscode", "keybindings_backup");
        const backupFile = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}--${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}_keybindings.json`;
        vscode.workspace.fs.createDirectory(vscode.Uri.file(backupDir));
        await vscode.workspace.fs.copy(
          globalKeybindingsUri,
          vscode.Uri.file(path.join(backupDir, backupFile)),
          { overwrite: false }
        );
      }
      const currentCustomKeybindingJSONString = await (async () => {
        // load existing custom keybindings and delete setting registered by this
        const currentKeybindingJSONString = await vscode.workspace.fs
          .readFile(globalKeybindingsUri)
          .then((byteContent) => new TextDecoder().decode(byteContent));
        const currentKeybindingJSON = jsonc.parseTree(
          currentKeybindingJSONString
        );
        let newKeybindingJSONString = currentKeybindingJSONString;
        if (currentKeybindingJSON && currentKeybindingJSON.type === "array") {
          // delete exisiting
          const indicesToDelete =
            currentKeybindingJSON.children
              ?.filter(isInsertedByThisExtension)
              .map((item) => jsonc.getNodePath(item).at(0))
              .filter((index) => typeof index === "number")
              .map((item) => item as number) || [];
          console.log("delete", indicesToDelete);
          indicesToDelete
            .sort((a, b) => b - a) // dec
            .forEach((i) => {
              const edits = jsonc.modify(
                newKeybindingJSONString,
                [i],
                undefined,
                {
                  formattingOptions: {
                    tabSize: 4,
                    insertSpaces: true,
                  },
                }
              );
              newKeybindingJSONString = jsonc.applyEdits(
                newKeybindingJSONString,
                edits
              );
            });
        }
        return newKeybindingJSONString;
      })();
      console.info("Preserving", currentCustomKeybindingJSONString);
      {
        // disable all extension keybind settings
        const allKeybindings = collectKeybindings();
        const validateConfig = (value: any) =>
          Array.isArray(value) &&
          value.map((v) => typeof v === "string").reduce((a, b) => a && b, true)
            ? value
            : [];
        const extensionsToPreserve: Array<string> = validateConfig(
          vscode.workspace
            .getConfiguration("disable-keyshortcut")
            .get("extensionsToPreserve")
        );
        const commandsToPreserve: Array<string> = validateConfig(
          vscode.workspace
            .getConfiguration("disable-keyshortcut")
            .get("commandsToPreserve")
        );

        const keybindingsToDisable = allKeybindings
          .filter(
            (kb) =>
              !extensionsToPreserve
                .map((re) => kb.extensionId.match(re) !== null)
                .reduce((a, b) => a || b, false)
          )
          .filter(
            (kb) =>
              !commandsToPreserve
                .map((re) => kb.command.match(re) !== null)
                .reduce((a, b) => a || b, false)
          );
        let newKeybindingJSONString = currentCustomKeybindingJSONString;
        let i =
          jsonc.parseTree(currentCustomKeybindingJSONString)?.children
            ?.length || 0;
        // insert disable setting
        keybindingsToDisable.forEach((keybinding) => {
          const edits = jsonc.modify(
            newKeybindingJSONString,
            [i],
            {
              key: keybinding.key,
              command: "-" + keybinding.command,
              extensionId: keybinding.extensionId,
              note: "Registered by disable-keyshortcut extension",
            },
            {
              formattingOptions: {
                tabSize: 4,
                insertSpaces: true,
              },
              isArrayInsertion: true,
            }
          );
          newKeybindingJSONString = jsonc.applyEdits(
            newKeybindingJSONString,
            edits
          );
          i++;
        });
        await vscode.workspace.fs.writeFile(
          globalKeybindingsUri,
          new TextEncoder().encode(newKeybindingJSONString)
        );
      }
    }
  ));
}

// This method is called when your extension is deactivated
export function deactivate() {}
