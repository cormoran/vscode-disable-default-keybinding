import * as vscode from "vscode";

export interface Keybinding {
  key: String;
  command: String;
  extensionId: String | undefined;
}

/**
 * Search all installed extensions' package json and collect keybindings.
 * platform specific keybindings are respected if specified.
 * @returns list of keybindings
 */
export function collectAllDefaultKeybindings(): Array<Keybinding> {
  const osKey = (() => {
    switch (process.platform) {
      case "win32":
        return "win";
      case "darwin":
        return "mac";
      case "linux":
        return "linux";
      default:
        return null;
    }
  })();
  return vscode.extensions.all.flatMap((extension) =>
    ((extension.packageJSON.contributes?.keybindings as Array<any>) || [])
      .filter((keybinding) => keybinding !== undefined)
      .map((keybinding) => {
        if ("command" in keybinding && "key" in keybinding) {
          const key: String =
            keybinding[osKey && osKey in keybinding ? osKey : "key"];
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
      .filter(
        (keybinding): keybinding is Keybinding => keybinding !== undefined
      )
      .filter((keybinding) => keybinding.command.length > 0)
  );
}
