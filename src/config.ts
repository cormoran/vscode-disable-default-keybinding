import {workspace} from "vscode";

const SECTION = "disable-keyshortcut";

function validateConfig(value: any) {
  return Array.isArray(value) &&
    value.map((v) => typeof v === "string").reduce((a, b) => a && b, true)
    ? value
    : [];
}

export function getExtensionsToPreserveKeybinding(): Array<string> {
    return validateConfig(workspace
        .getConfiguration(SECTION)
        .get("extensionsToPreserve"));
}

export function getCommandsToPreserveKeybinding(): Array<string> {
    return validateConfig(workspace
        .getConfiguration(SECTION)
        .get("extensionsToPreserve"));
}