// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "disable-keyshortcut" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "disable-keyshortcut.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage(
        "Hello World from disable-keyshortcut!"
      );

      if (vscode.workspace.workspaceFolders) {
        const newFile = vscode.Uri.parse(
          "untitled:" +
            path.join(
              vscode.workspace.workspaceFolders[0]?.uri.path!!,
              "keybindings.json"
            )
        );
        vscode.workspace.openTextDocument(newFile).then((document) => {
          const edit = new vscode.WorkspaceEdit();
          let position = new vscode.Position(0, 0);
          edit.insert(newFile, position, "[\n");
          vscode.extensions.all.forEach((extension) => {
            if ("contributes" in extension.packageJSON) {
              if ("keybindings" in extension.packageJSON["contributes"]) {
                const keybindings =
                  extension.packageJSON["contributes"]["keybindings"];
                let keybindingJson = `    // ${extension.id}\n`;
                for (const binding of extension.packageJSON["contributes"][
                  "keybindings"
                ]) {
                  const command: String = binding["command"];
                  const key: String = binding["key"];
                  if (key && command) {
                    keybindingJson +=
                      JSON.stringify(
                        {
                          key: key,
                          command: "-" + command,
                        },
                        null,
                        4
                      ) + ",\n";
                  }
                }
                edit.insert(newFile, position, keybindingJson);
              }
            }
          });
          edit.insert(newFile, position, "]");
          return vscode.workspace.applyEdit(edit).then((success) => {
            if (success) {
              vscode.window.showTextDocument(document);
            } else {
              vscode.window.showInformationMessage("Error!");
            }
          });
        });
      }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
