import * as assert from "assert";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as jsonc from "jsonc-parser";
import * as sinon from "sinon";
import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";
import { collectBackupFiles } from "../../backup";
import {
  COMMANDS_TO_PRESERVE,
  EXTENSIONS_TO_PRESERVE,
  SECTION,
} from "../../config";
import { openAndGetGlobalKeybindingsUri } from "../../customKeybinding";
import { Keybinding } from "../../defaultKeybinding";
import * as myExtension from "../../extension";
import path = require("path");

function getThisExtension() {
  const thisExtension = vscode.extensions.getExtension(
    "undefined_publisher." + myExtension.EXTENSION_NAME
  );

  if (!thisExtension) {
    assert.fail("failed to get this extension");
  }
  return thisExtension;
}

async function resetConfiguration() {
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

async function resetKeybindingsJSON() {
  const customKeybindingsUri = await openAndGetGlobalKeybindingsUri();
  if (!customKeybindingsUri) {
    assert.fail();
  }
  await vscode.workspace.fs.writeFile(
    customKeybindingsUri,
    new TextEncoder().encode("[]")
  );
}

suite("Extension Test Suite", () => {
  const sandbox = sinon.createSandbox();
  teardown(async () => {
    await resetConfiguration();
    await resetKeybindingsJSON();
    sandbox.restore();
    const quickPick = sandbox.stub(vscode.window, "showQuickPick") as any;
    quickPick.resolves("Yes");
    await vscode.commands.executeCommand(myExtension.COMMAND_DELETE_BACKUP);
    sandbox.restore();
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

    test(`Backup works`, async () => {
      const config = await getThisExtension().activate();
      // update config to modify keybinding.json
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
      const customKeybindingsJSONCString = `[
    // comment
    {
        // comment
        "key": "alt+g alt+g",
        // hello
        "command": "workbench.action.gotoLine"
        // world!
    },
    {
        // comment
        "key": "cmd+j",
        "command": "workbench.action.terminal.toggleTerminal"
    }
]`;
      await vscode.workspace.fs.writeFile(
        customKeybindingsUri,
        new TextEncoder().encode(customKeybindingsJSONCString)
      );

      const quickPick = sandbox.stub(vscode.window, "showQuickPick") as any;
      quickPick.onFirstCall().resolves("Yes");
      const future = await vscode.commands.executeCommand(
        myExtension.COMMAND_DISABLE_KEYBINDINGS
      );
      await future;

      const backupDir = config.backupDir;
      const backupFiles = await collectBackupFiles(backupDir);
      assert.equal(backupFiles.length, 1, "backup should exist");

      const backupJSONCString = await vscode.workspace.fs
        .readFile(vscode.Uri.file(path.join(backupDir, backupFiles.at(0)!)))
        .then((byteContent) => new TextDecoder().decode(byteContent));

      assert.equal(
        backupJSONCString,
        customKeybindingsJSONCString,
        "backup should be the same to original keybinding.json"
      );

      const storedJSONCString = await vscode.workspace.fs
        .readFile(customKeybindingsUri)
        .then((byteContent) => new TextDecoder().decode(byteContent));

      // restore
      quickPick.onSecondCall().resolves(backupFiles.at(0)!);
      const future2 = await vscode.commands.executeCommand(
        myExtension.COMMAND_RESTORE_BACKUP
      );
      await future2;

      const restoredJSONCString = await vscode.workspace.fs
        .readFile(customKeybindingsUri)
        .then((byteContent) => new TextDecoder().decode(byteContent));

      assert.equal(
        restoredJSONCString,
        customKeybindingsJSONCString,
        "restore command should restore original keybindings.json"
      );

      const backupFiles2 = await collectBackupFiles(backupDir);
      assert.equal(
        backupFiles2.length,
        2,
        "restore command should create backup"
      );
      quickPick.onThirdCall().resolves("Yes");
      await vscode.commands.executeCommand(myExtension.COMMAND_DELETE_BACKUP);
      const backupFiles3 = await collectBackupFiles(backupDir);
      assert.equal(
        backupFiles3.length,
        0,
        "delete backup command should cleanup backups"
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
    const initialKeybindingsJSONCString = `[
        {
            "key": "alt+g alt+g",
            "command": "workbench.action.gotoLine"
        },
        {
            "key": "cmd+j",
            "command": "workbench.action.terminal.toggleTerminal"
        }
    ]`;
    await vscode.workspace.fs.writeFile(
      customKeybindingsUri,
      new TextEncoder().encode(initialKeybindingsJSONCString)
    );

    const quickPick = sandbox.stub(vscode.window, "showQuickPick") as any;
    quickPick.resolves("Yes");
    const future = await vscode.commands.executeCommand(
      myExtension.COMMAND_DISABLE_KEYBINDINGS
    );
    await future;

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

    let myCustomKeybindings: Array<Keybinding> = [
      {
        key: "alt+g alt+g",
        command: "workbench.action.gotoLine",
        extensionId: undefined,
      },
      {
        key: "cmd+j",
        command: "workbench.action.terminal.toggleTerminal",
        extensionId: undefined,
      },
    ];

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

    vscodeKeybindings.concat(myCustomKeybindings).forEach((keybinding) => {
      assert(
        (customKeybinding as Array<any>).find(
          (kb) =>
            keybinding.extensionId === kb.extensionId &&
            keybinding.command === kb.command &&
            keybinding.key === kb.key
        ),
        `${JSON.stringify(keybinding)} not found in keybindings.json`
      );
    });
  });
});
