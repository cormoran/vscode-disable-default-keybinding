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
import * as myExtension from "../../extension";
import {
  disableKeybindings,
  loadKeybindingsJSON,
  resetConfiguration,
  resetKeybindingsJSON,
  withQuickPick,
  writeFile,
} from "../util/testUtil";
import path = require("path");

const COMMAND = myExtension.COMMAND_DISABLE_KEYBINDINGS;

if (!("withPythonExtension" in process.env)) {
  suite(`${COMMAND} with existing custom keybindings`, () => {
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

    test(`It doesn't erase user defined valid keybindings`, async () => {
      const customKeybindingsUri = await customKeybindingsUriFuture;
      const initialJSONCString = `[
        {
            "key": "shift+a",
            "command": "workbench.action.gotoLine"
        },
        {
            "key": "shift+b",
            "command": "-workbench.action.terminal.toggleTerminal"
        }
    ]`;
      await writeFile(customKeybindingsUri, initialJSONCString);
      await disableKeybindings(sandbox);
      const afterDisable = await loadKeybindingsJSON(customKeybindingsUri);

      (JSON.parse(initialJSONCString) as any[]).forEach((kb) => {
        assert(
          afterDisable.array!.find(
            (kb2: any) => JSON.stringify(kb) === JSON.stringify(kb2)
          ),
          `${JSON.stringify(kb)} not found in keybindings.json`
        );
      });
    });

    test(`It doesn't erase user defined invalid keybindings (broken json)`, async () => {
      const customKeybindingsUri = await customKeybindingsUriFuture;
      const initialJSONCString = `{ "foo: 1 }`;
      await writeFile(customKeybindingsUri, initialJSONCString);
      await assert.rejects(async () => {
        await disableKeybindings(sandbox);
      }, "command should fail for invalid format keybindings.json");
      const afterDisable = await loadKeybindingsJSON(customKeybindingsUri, {
        shouldValidJSONC: false,
      });
      assert.equal(
        afterDisable.jsonc,
        initialJSONCString,
        "it should not mutate keybindings.json file"
      );
    });

    test(`It doesn't erase user defined invalid keybindings (not array)`, async () => {
      const customKeybindingsUri = await customKeybindingsUriFuture;
      const initialJSONCString = `{ "foo": 1 }`;
      await writeFile(customKeybindingsUri, initialJSONCString);
      // command should fail
      await assert.rejects(async () => {
        await disableKeybindings(sandbox);
      }, "command should fail for non array keybindings.json");
      const afterDisable = await loadKeybindingsJSON(customKeybindingsUri, {
        shouldValidArray: false,
      });
      assert.equal(
        afterDisable.jsonc,
        initialJSONCString,
        "it should not mutate keybindings.json file"
      );
    });

    test(`It doesn't erase user defined invalid keybindings (with invalid item)`, async () => {
      const customKeybindingsUri = await customKeybindingsUriFuture;
      const initialJSONCString = `[
              {
                  "key": "shift+a",
                  "command": "workbench.action.gotoLine"
              },
              {
                  "foo": "bar",
                  "OK": false
              }
          ]`;
      await writeFile(customKeybindingsUri, initialJSONCString);
      await disableKeybindings(sandbox);

      const afterDisable = await loadKeybindingsJSON(customKeybindingsUri);
      (JSON.parse(initialJSONCString) as any[]).forEach((kb) => {
        assert(
          afterDisable.array!.find(
            (kb2: any) => JSON.stringify(kb) === JSON.stringify(kb2)
          ),
          `${JSON.stringify(kb)} not found in keybindings.json`
        );
      });
    });

    test(`It doesn't erase comment in user defined keybindings`, async () => {
      const customKeybindingsUri = await customKeybindingsUriFuture;
      const initialJSONCString = `
        // Test:Comment01
        [ // Test:Comment02
            // Test:Comment03
            { // Test:Comment04
                // Test:Comment05
                "key": "shift+a", // Test:Comment06
                // Test:Comment07
                "command": "workbench.action.gotoLine"
                // Test:Comment08
            }, // Test:Comment09
            // Test:Comment10
            { // Test:Comment11
                "key": "shift+a",
                "command": "workbench.action.gotoLine"
            } // Test:Comment12
              // Test:Comment13
          ] // Test:Comment14`;
      const allowedToErase = new Set([12, 13]); // TODO: try preserving them
      await writeFile(customKeybindingsUri, initialJSONCString);
      await disableKeybindings(sandbox);
      // apply twice
      await disableKeybindings(sandbox);

      const afterDisable = await loadKeybindingsJSON(customKeybindingsUri);
      const commentCount =
        initialJSONCString.split("// Test:Comment").length - 1;
      for (let i = 1; i <= commentCount; i++) {
        if (!allowedToErase.has(i)) {
          assert(
            afterDisable.jsonc.includes(
              `// Test:Comment${i.toString().padStart(2, "0")}`
            ),
            `Comment ${i} not found in <${afterDisable.jsonc}>`
          );
        }
      }
    });
  });
}
