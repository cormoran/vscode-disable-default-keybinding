import * as jsonc from "jsonc-parser";
import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";
import { backupKeybindingFile } from "./backup";
import {
  getCommandsToPreserveKeybinding,
  getExtensionsToPreserveKeybinding,
} from "./config";
import { openAndGetGlobalKeybindingsUri } from "./customKeybinding";
import { collectAllDefaultKeybindings, Keybinding } from "./defaultKeybinding";

export const REGISTERED_BY = "cormoran.disable-default-keybinding";

/**
 * Get string value of given key from given object node.
 */
function getObjectNodeValue(node: jsonc.Node, key: string): string | undefined {
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

/**
 * Returns whether given item of keybinding.json is registered by this extension or not.
 * @param node one item of keybinding.json e.g. { "key": "foo", "command": "bar" }
 */
function isInsertedByThisExtension(node: jsonc.Node) {
  return (
    node.type === "object" &&
    getObjectNodeValue(node, "key") !== undefined &&
    getObjectNodeValue(node, "command") !== undefined &&
    getObjectNodeValue(node, "extensionId") !== undefined &&
    getObjectNodeValue(node, "registeredBy") === REGISTERED_BY
  );
}

export function isKeybindingRegisteredByExtension(
  keybinding: Keybinding,
  extensionsRegex: string[]
) {
  return extensionsRegex
    .map((re) => keybinding.extensionId?.match(re) !== null)
    .reduce((a, b) => a || b, false);
}

export function isKeybindingCommandMatches(
  keybinding: Keybinding,
  commandsRegex: string[]
) {
  return commandsRegex
    .map((re) => keybinding.command.match(re) !== null)
    .reduce((a, b) => a || b, false);
}

/**
 * Remove keybindings registered by this extension from given keybindings.json content.
 *
 * @param customKeybindingJSONString
 * @returns
 */
export function filterOutKeybindingsRegisteredByThisExtension(
  customKeybindingJSONString: string
) {
  const customKeybindingJSON = jsonc.parseTree(customKeybindingJSONString);
  if (!customKeybindingJSON) {
    throw Error(
      `Failed to parse keybindings as jsonc: ${customKeybindingJSONString}`
    );
  }
  let newKeybindingJSONString = customKeybindingJSONString;
  if (customKeybindingJSON.type === "array") {
    // delete existing
    const indicesToDelete =
      customKeybindingJSON.children
        ?.filter(isInsertedByThisExtension)
        .map((item) => jsonc.getNodePath(item).at(0))
        .filter((index) => typeof index === "number")
        .map((item) => item as number) || [];
    indicesToDelete
      .sort((a, b) => b - a) // dec
      .forEach((i) => {
        const edits = jsonc.modify(newKeybindingJSONString, [i], undefined, {
          formattingOptions: {
            tabSize: 4,
            insertSpaces: true,
          },
        });
        newKeybindingJSONString = jsonc.applyEdits(
          newKeybindingJSONString,
          edits
        );
      });
  } else {
    throw Error(
      `Content of keybindings file is not array: ${customKeybindingJSONString}`
    );
  }
  return newKeybindingJSONString;
}

/**
 * Return new JSONString which contains keybindings in currentCustomKeybindingJSONString
 * and settings to enable/disable given keybindings.
 * keybindings are added at the bottom of the JSON array in given order.
 * @param currentCustomKeybindingJSONString valid keybindings.json content
 * @param keybindings list of keybindings
 * @param disable whether to register keybinding as disable setting (-command) or not.
 * @returns new keybindings.json content
 */
export function addKeybindingsToJSON(
  currentCustomKeybindingJSONString: string,
  keybindings: Keybinding[],
  disable: boolean
) {
  let newKeybindingJSONString = currentCustomKeybindingJSONString;
  let i =
    jsonc.parseTree(currentCustomKeybindingJSONString)?.children?.length || 0;
  // insert disable setting
  keybindings.forEach((keybinding) => {
    const edits = jsonc.modify(
      newKeybindingJSONString,
      [i],
      {
        key: keybinding.key,
        command: (disable ? "-" : "") + keybinding.command,
        extensionId: keybinding.extensionId,
        registeredBy: REGISTERED_BY,
      },
      {
        formattingOptions: {
          tabSize: 4,
          insertSpaces: true,
        },
        isArrayInsertion: true,
      }
    );
    newKeybindingJSONString = jsonc.applyEdits(newKeybindingJSONString, edits);
    i++;
  });
  return newKeybindingJSONString;
}

export async function buildNewKeybindingsJSONString(
  currentAllCustomKeybindingsJSONString: string,
  extensionsToPreserve: string[],
  commandsToPreserve: string[]
) {
  const currentCustomKeybindingJSONString =
    filterOutKeybindingsRegisteredByThisExtension(
      currentAllCustomKeybindingsJSONString
    );
  const allDefaultKeybindings = collectAllDefaultKeybindings();

  const keybindingsToDisable = allDefaultKeybindings
    .filter(
      (kb) => !isKeybindingRegisteredByExtension(kb, extensionsToPreserve)
    )
    .filter((kb) => !isKeybindingCommandMatches(kb, commandsToPreserve));

  return addKeybindingsToJSON(
    currentCustomKeybindingJSONString,
    keybindingsToDisable,
    true
  );
}

/**
 * Update keybindings file to disable all default keybindings.
 * @param globalKeybindingsUri uri of keybindings.json
 * @param extensionsToPreserve list of regex of extensionIds to preserve keybindings
 * @param commandsToPreserve list of regex of commands to preserve keybindings
 * @param executionDecider function to decide updating keybindings.json file. Called only when the change exists.
 * @returns true if keybindings.json was updated. false if there is nothing to change or executionDecider returns false.
 */
export async function disableDefaultKeybindings(
  globalKeybindingsUri: vscode.Uri,
  extensionsToPreserve: string[],
  commandsToPreserve: string[],
  backupDir: string,
  executionDecider: () => Promise<boolean>
) {
  const currentKeybindingsJSONString = await vscode.workspace.fs
    .readFile(globalKeybindingsUri)
    .then((byteContent) => new TextDecoder().decode(byteContent));
  const newKeybindingJSONString = await buildNewKeybindingsJSONString(
    currentKeybindingsJSONString,
    extensionsToPreserve,
    commandsToPreserve
  );
  if (
    currentKeybindingsJSONString !== newKeybindingJSONString &&
    (await executionDecider())
  ) {
    await backupKeybindingFile(globalKeybindingsUri, backupDir);
    await vscode.workspace.fs.writeFile(
      globalKeybindingsUri,
      new TextEncoder().encode(newKeybindingJSONString)
    );
    return true;
  }
  return false;
}

export async function disableDefaultKeybindingsIfChanged(backupDir: string) {
  const globalKeybindingsUri = await openAndGetGlobalKeybindingsUri();
  if (!globalKeybindingsUri) {
    return;
  }
  const updated = await disableDefaultKeybindings(
    globalKeybindingsUri,
    getExtensionsToPreserveKeybinding(),
    getCommandsToPreserveKeybinding(),
    backupDir,
    async () => {
      const answer = await vscode.window.showQuickPick(["Skip", "Yes"], {
        title: `Keybinding set was changed. Will you run disable-default-keybinding?`,
      });
      return answer === "Yes";
    }
  );
  if (updated) {
    vscode.window.showInformationMessage(
      `keybindings.json was updated by disable-default-keybindings plugin.`
    );
  }
}

export async function confirmAndDisableDefaultKeybindings(backupDir: string) {
  const globalKeybindingsUri = await openAndGetGlobalKeybindingsUri();
  if (!globalKeybindingsUri) {
    return;
  }
  let yes = false; // TODO: ちゃんと実装する
  const updated = await disableDefaultKeybindings(
    globalKeybindingsUri,
    getExtensionsToPreserveKeybinding(),
    getCommandsToPreserveKeybinding(),
    backupDir,
    async () => {
      const answer = await vscode.window.showQuickPick(["Cancel", "Yes"], {
        title: `This command will update your custom keybindings.json after backup. Will you proceed?`,
      });
      yes = answer === "Yes";
      return yes;
    }
  );
  if (updated) {
    vscode.window.showInformationMessage(`keybindings.json is updated.`);
  } else if (yes) {
    vscode.window.showInformationMessage(`No keybindings to newly disable.`);
  }
}
