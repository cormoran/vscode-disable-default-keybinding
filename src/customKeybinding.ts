import * as vscode from "vscode";

export async function openAndGetGlobalKeybindingsUri(): Promise<vscode.Uri | undefined> {
    await vscode.commands.executeCommand(
      "workbench.action.openGlobalKeybindingsFile"
    );
    const tabUris = vscode.window.tabGroups.all
      .flatMap((tagGroup) => tagGroup.tabs)
      .filter((tab) => tab.input && (tab.input as any).uri !== null)
      .map((tab) => (tab.input as any).uri as vscode.Uri);
    const globalKeybindingsUri = tabUris.find(
      (uri) =>
        uri.scheme === "vscode-userdata" && uri.path.endsWith("/keybindings.json")
    );
    return globalKeybindingsUri;
  }