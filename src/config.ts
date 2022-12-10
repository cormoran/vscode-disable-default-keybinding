import { workspace } from "vscode";

export const SECTION = "disable-default-keybinding";
export const EXTENSIONS_TO_PRESERVE = "extensionsToPreserve";
export const COMMANDS_TO_PRESERVE = "extensionsToPreserve";
function validateConfig(value: any) {
  return Array.isArray(value) &&
    value.map((v) => typeof v === "string").reduce((a, b) => a && b, true)
    ? value
    : [];
}

export function getExtensionsToPreserveKeybinding(): Array<string> {
  return validateConfig(
    workspace.getConfiguration(SECTION).get(EXTENSIONS_TO_PRESERVE)
  );
}

export function getCommandsToPreserveKeybinding(): Array<string> {
  return validateConfig(
    workspace.getConfiguration(SECTION).get(COMMANDS_TO_PRESERVE)
  );
}
