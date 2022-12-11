import * as assert from "assert";
import * as jsonc from "jsonc-parser";
import { SinonSandbox } from "sinon";
import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";
import { openAndGetGlobalKeybindingsUri } from "../../customKeybinding";
import * as myExtension from "../../extension";
export function getThisExtension() {
  const thisExtension = vscode.extensions.getExtension(
    "cormoran." + myExtension.EXTENSION_NAME
  );

  if (!thisExtension) {
    assert.fail("failed to get this extension");
  }
  return thisExtension;
}

export async function resetConfiguration() {
  const thisExtension = getThisExtension();
  const properties =
    thisExtension.packageJSON.contributes?.configuration?.properties;
  if (!properties) {
    assert.fail("failed to get properties from packageJSON");
  }
  for (const key of Object.keys(properties)) {
    await vscode.workspace
      .getConfiguration()
      .update(key, properties[key].default, vscode.ConfigurationTarget.Global);
  }
}

export async function resetKeybindingsJSON() {
  const customKeybindingsUri = await openAndGetGlobalKeybindingsUri();
  if (!customKeybindingsUri) {
    assert.fail();
  }
  await vscode.workspace.fs.writeFile(
    customKeybindingsUri,
    new TextEncoder().encode("[]")
  );
}

export async function withQuickPick<T>(
  selection: string,
  callable: () => Promise<T>,
  sandbox: SinonSandbox
) {
  const quickPick = sandbox.stub(vscode.window, "showQuickPick") as any;
  quickPick.resolves(selection);
  const res = await callable();
  quickPick.restore();
  return res;
}

function tryDo<T>(func: () => T) {
  let result: T | undefined = undefined;
  let error: any | undefined = undefined;
  try {
    result = func();
  } catch (e) {
    error = e;
  }
  return [result, error] as const;
}

const defaultLoadGlobalCustomKeybindingsJSONConfig = {
  shouldValidJSONC: true,
  shouldValidJSON: true,
  shouldValidArray: true,
};
export async function loadGlobalCustomKeybindingsJSON(
  config = defaultLoadGlobalCustomKeybindingsJSONConfig as Partial<
    typeof defaultLoadGlobalCustomKeybindingsJSONConfig
  >
) {
  const uri = await openAndGetGlobalKeybindingsUri();
  if (!uri) {
    assert.fail("Failed to load global custom keybindings.json");
  }
  return loadKeybindingsJSON(uri, config);
}

export async function loadKeybindingsJSON(
  uri: vscode.Uri,
  config = defaultLoadGlobalCustomKeybindingsJSONConfig as Partial<
    typeof defaultLoadGlobalCustomKeybindingsJSONConfig
  >
) {
  config = Object.assign(
    {},
    defaultLoadGlobalCustomKeybindingsJSONConfig,
    config
  );
  const jsoncString = await vscode.workspace.fs
    .readFile(uri)
    .then((byteContent) => new TextDecoder().decode(byteContent));
  const [jsonString, error] = tryDo(() => jsonc.stripComments(jsoncString));
  if (config.shouldValidJSONC && (error || !jsonString)) {
    assert.fail(
      `Invalid jsonc string: error<${error}>, string<${jsoncString}>`
    );
  }
  const [jsonObject, error2] = jsonString
    ? tryDo(() => JSON.parse(jsonString) as object)
    : [undefined, undefined];
  if (
    config.shouldValidJSONC &&
    config.shouldValidJSON &&
    (error2 || !jsonObject)
  ) {
    assert.fail(`Invalid json string: error<${error}>, string<${jsonString}>`);
  }
  const keybindingArray =
    jsonObject && Array.isArray(jsonObject)
      ? (jsonObject as object[])
      : undefined;
  if (
    config.shouldValidJSONC &&
    config.shouldValidJSON &&
    config.shouldValidArray &&
    !keybindingArray
  ) {
    assert.fail(`Keybinding content is not array: ${jsonString}`);
  }
  return {
    uri: uri,
    jsonc: jsoncString,
    json: jsonString,
    object: jsonObject,
    array: keybindingArray,
  };
}

export function writeFile(uri: vscode.Uri, content: string) {
  return vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

export function disableKeybindings(sandbox: SinonSandbox) {
  return withQuickPick(
    "Yes",
    async () => {
      await await vscode.commands.executeCommand(
        myExtension.COMMAND_DISABLE_KEYBINDINGS
      );
    },
    sandbox
  );
}
