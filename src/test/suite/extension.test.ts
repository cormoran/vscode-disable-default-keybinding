import * as assert from "assert";
import * as mocha from "mocha";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as myExtension from "../../extension";
import * as sinon from "sinon";
import { openAndGetGlobalKeybindingsUri } from "../../customKeybinding";
import { TextDecoder } from "util";
import * as jsonc from "jsonc-parser";
import {
  COMMANDS_TO_PRESERVE,
  EXTENSIONS_TO_PRESERVE,
  SECTION,
} from "../../config";
import { Keybinding } from "../../defaultKeybinding";

async function resetConfiguration() {
  const thisExtension = vscode.extensions.getExtension(
    "undefined_publisher." + myExtension.EXTENSION_NAME
  );
  if (!thisExtension) {
    assert.fail("failed to get this extension");
  }
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

suite("Extension Test Suite", () => {
  const sandbox = sinon.createSandbox();
  teardown(async () => {
    sandbox.restore();
    await resetConfiguration();
  });

  if (!("withPythonExtension" in process.env)) {
    test(`${myExtension.COMMAND_DISABLE_KEYBINDINGS} doesn't disable any vscode default keybindings`, async () => {
      const quickPick = sandbox.stub(vscode.window, "showQuickPick") as any;
      quickPick.resolves("Yes");
      const future = await vscode.commands.executeCommand(
        myExtension.COMMAND_DISABLE_KEYBINDINGS
      );
      await future;

      const customKeybindingsUri = await openAndGetGlobalKeybindingsUri();
      if (!customKeybindingsUri) {
        assert.fail();
      }
      const customKeybindingsJSONCString = await vscode.workspace.fs
        .readFile(customKeybindingsUri)
        .then((byteContent) => new TextDecoder().decode(byteContent));
      const customKeybindingsJSONString = jsonc.stripComments(
        customKeybindingsJSONCString
      );
      const customKeybinding = JSON.parse(customKeybindingsJSONString);
      assert(Array.isArray(customKeybinding));
      assert.equal(
        customKeybinding.length,
        0,
        `Unexpectedly disabled vscode keybindings with default configuration: ${customKeybindingsJSONCString}`
      );
    });
  }

  test(`${myExtension.COMMAND_DISABLE_KEYBINDINGS} disables all keybindings if no preserve setting`, async () => {
    await vscode.workspace
      .getConfiguration(SECTION)
      .update(EXTENSIONS_TO_PRESERVE, [], vscode.ConfigurationTarget.Global);
    await vscode.workspace
      .getConfiguration(SECTION)
      .update(COMMANDS_TO_PRESERVE, [], vscode.ConfigurationTarget.Global);

    const quickPick = sandbox.stub(vscode.window, "showQuickPick") as any;
    quickPick.resolves("Yes");
    const future = await vscode.commands.executeCommand(
      myExtension.COMMAND_DISABLE_KEYBINDINGS
    );
    await future;

    const customKeybindingsUri = await openAndGetGlobalKeybindingsUri();
    if (!customKeybindingsUri) {
      assert.fail();
    }
    const customKeybindingsJSONCString = await vscode.workspace.fs
      .readFile(customKeybindingsUri)
      .then((byteContent) => new TextDecoder().decode(byteContent));
    const customKeybindingsJSONString = jsonc.stripComments(
      customKeybindingsJSONCString
    );
    const customKeybinding = JSON.parse(customKeybindingsJSONString);
    assert(Array.isArray(customKeybinding));
    (customKeybinding as Array<Object>).forEach((keybinding) => {
      assert(keybinding.hasOwnProperty("key"));
      assert(keybinding.hasOwnProperty("command"));
    });

    let vscodeKeybindings: Array<Keybinding> = [
      {
        extensionId: "ms-vscode.js-debug",
        key: "F10",
        command: "-extension.node-debug.startWithStopOnEntry",
      },
      {
        key: "f4",
        command: "-references-view.next",
        extensionId: "vscode.references-view",
      },
    ];

    if (process.env.withPythonExtension) {
      vscodeKeybindings = vscodeKeybindings.concat([
        {
          key: "shift+enter",
          command: "-python.execSelectionInTerminal",
          extensionId: "ms-python.python",
        },
      ]);
    }

    vscodeKeybindings.forEach((keybinding) => {
      assert(
        (customKeybinding as Array<any>).find(
          (kb) =>
            keybinding.extensionId === kb.extensionId &&
            keybinding.command === kb.command &&
            keybinding.key === kb.key
        )
      );
    });
  });
});
