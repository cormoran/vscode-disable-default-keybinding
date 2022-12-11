import * as assert from "assert";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  COMMANDS_TO_PRESERVE,
  EXTENSIONS_TO_PRESERVE,
  SECTION,
} from "../../config";
import { openAndGetGlobalKeybindingsUri } from "../../customKeybinding";
import { Keybinding } from "../../defaultKeybinding";
import { REGISTERED_BY } from "../../disableKeybinding";
import * as myExtension from "../../extension";
import {
  loadGlobalCustomKeybindingsJSON,
  loadKeybindingsJSON,
  resetConfiguration,
  resetKeybindingsJSON,
  withQuickPick,
} from "../util/testUtil";
import path = require("path");

suite(`Disable default keybindings feature`, () => {
  const sandbox = sinon.createSandbox();
  teardown(async () => {
    await resetConfiguration();
    await resetKeybindingsJSON();
    sandbox.restore();
    await withQuickPick(
      "Yes",
      async () => {
        return await vscode.commands.executeCommand(
          myExtension.COMMAND_DELETE_BACKUP
        );
      },
      sandbox
    );
  });

  if (!("withPythonExtension" in process.env)) {
    test(`${myExtension.COMMAND_DISABLE_KEYBINDINGS} doesn't disable any vscode default keybindings`, async () => {
      await withQuickPick(
        "Yes",
        async () => {
          await await vscode.commands.executeCommand(
            myExtension.COMMAND_DISABLE_KEYBINDINGS
          );
        },
        sandbox
      );
      const customKeybinding = await loadGlobalCustomKeybindingsJSON();
      assert.equal(
        customKeybinding.array?.length,
        0,
        `Unexpectedly disabled vscode keybindings with default configuration: ${customKeybinding.jsonc}`
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

    const customKeybindingsUri = await openAndGetGlobalKeybindingsUri();
    if (!customKeybindingsUri) {
      assert.fail();
    }

    await withQuickPick(
      "Yes",
      async () => {
        await await vscode.commands.executeCommand(
          myExtension.COMMAND_DISABLE_KEYBINDINGS
        );
      },
      sandbox
    );

    const afterDisable = await loadKeybindingsJSON(customKeybindingsUri);

    afterDisable.array!.forEach((keybinding) => {
      // assume all custom keybindings are registered by this extension
      assert(keybinding.hasOwnProperty("key"));
      assert(keybinding.hasOwnProperty("command"));
      assert(keybinding.hasOwnProperty("extensionId"));
      assert(keybinding.hasOwnProperty("registeredBy"));
      assert.equal((keybinding as any).registeredBy, REGISTERED_BY);
    });

    const vscodeKeybindings: Array<Keybinding> = [
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

    const extensionKeybindings = process.env.withPythonExtension
      ? [
          {
            key: "shift+enter",
            command: "-python.execSelectionInTerminal",
            extensionId: "ms-python.python",
          },
        ]
      : [];

    vscodeKeybindings.concat(extensionKeybindings).forEach((keybinding) => {
      assert(
        afterDisable.array!.find(
          (kb: any) =>
            keybinding.extensionId === kb.extensionId &&
            keybinding.command === kb.command &&
            keybinding.key === kb.key
        ),
        `${JSON.stringify(keybinding)} not found in keybindings.json`
      );
    });
  });
});
