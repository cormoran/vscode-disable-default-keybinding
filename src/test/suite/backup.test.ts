import * as assert from "assert";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as sinon from "sinon";
import * as vscode from "vscode";
import { collectBackupFiles } from "../../backup";
import {
  COMMANDS_TO_PRESERVE,
  EXTENSIONS_TO_PRESERVE,
  SECTION,
} from "../../config";
import { openAndGetGlobalKeybindingsUri } from "../../customKeybinding";
import * as myExtension from "../../extension";
import {
  disableKeybindings,
  getThisExtension,
  loadKeybindingsJSON,
  resetConfiguration,
  resetKeybindingsJSON,
  withQuickPick,
  writeFile,
} from "../util/testUtil";
import path = require("path");

if (!("withPythonExtension" in process.env)) {
  suite("Backup feature", () => {
    const sandbox = sinon.createSandbox();
    const customKeybindingsUriFuture = openAndGetGlobalKeybindingsUri().then(
      (v) => {
        if (!v) {
          assert.fail();
        }
        return v;
      }
    );

    setup(async () => {
      await vscode.workspace
        .getConfiguration(SECTION)
        .update(EXTENSIONS_TO_PRESERVE, [], vscode.ConfigurationTarget.Global);
      await vscode.workspace
        .getConfiguration(SECTION)
        .update(COMMANDS_TO_PRESERVE, [], vscode.ConfigurationTarget.Global);
    });
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

    test(`${myExtension.COMMAND_DISABLE_KEYBINDINGS} creates backup`, async () => {
      const config = await getThisExtension().activate();
      const customKeybindingsUri = await customKeybindingsUriFuture;
      const initialJSONCString = `[
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
      await writeFile(customKeybindingsUri, initialJSONCString);
      await disableKeybindings(sandbox);

      const backupDir = config.backupDir;
      const backupFiles = await collectBackupFiles(backupDir);
      assert.equal(backupFiles.length, 1, "backup should exist");

      const backupOfInitial = await loadKeybindingsJSON(
        vscode.Uri.file(path.join(backupDir, backupFiles.at(0)!))
      );

      assert.equal(
        backupOfInitial.jsonc,
        initialJSONCString,
        "backup should be the same to original keybinding.json"
      );

      const afterDisable = await loadKeybindingsJSON(customKeybindingsUri);
      assert.notEqual(
        afterDisable.jsonc,
        initialJSONCString,
        `${myExtension.COMMAND_DISABLE_KEYBINDINGS} should update keybindings.json`
      );
    });

    test(`${myExtension.COMMAND_RESTORE_BACKUP} restores backup`, async () => {
      const config = await getThisExtension().activate();
      const customKeybindingsUri = await customKeybindingsUriFuture;
      const initialJSONCString = `[
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
      await writeFile(customKeybindingsUri, initialJSONCString);
      await disableKeybindings(sandbox);

      const backupDir = config.backupDir;
      const backupFiles = await collectBackupFiles(backupDir);
      assert.equal(backupFiles.length, 1, "backup should exist");

      const afterDisable = await loadKeybindingsJSON(customKeybindingsUri);
      assert.notEqual(
        afterDisable.jsonc,
        initialJSONCString,
        `${myExtension.COMMAND_DISABLE_KEYBINDINGS} should update keybindings.json`
      );

      await withQuickPick(
        backupFiles.at(0)!,
        async () => {
          await await vscode.commands.executeCommand(
            myExtension.COMMAND_RESTORE_BACKUP
          );
        },
        sandbox
      );
      const afterRestore = await loadKeybindingsJSON(customKeybindingsUri);
      assert.equal(
        afterRestore.jsonc,
        initialJSONCString,
        "restore command should restore original keybindings.json"
      );
      assert.equal(
        (await collectBackupFiles(backupDir)).length,
        2,
        "restore command should create backup"
      );
    });

    test(`${myExtension.COMMAND_DELETE_BACKUP} deletes all backups`, async () => {
      const config = await getThisExtension().activate();
      await disableKeybindings(sandbox);
      await resetKeybindingsJSON();
      await disableKeybindings(sandbox);
      const backupDir = config.backupDir;
      const backupFiles = await collectBackupFiles(backupDir);
      assert.equal(backupFiles.length, 2, "backup should exist");

      await withQuickPick(
        "Yes",
        async () => {
          await vscode.commands.executeCommand(
            myExtension.COMMAND_DELETE_BACKUP
          );
        },
        sandbox
      );
      assert.equal(
        (await collectBackupFiles(backupDir)).length,
        0,
        "delete backup command should cleanup backups"
      );
    });
  });
}
