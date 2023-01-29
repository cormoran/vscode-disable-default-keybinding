[![Test](https://github.com/cormoran/vscode-disable-default-keybinding/actions/workflows/test.yml/badge.svg)](https://github.com/cormoran/vscode-disable-default-keybinding/actions/workflows/test.yml)

# Disable Default Keybindings Extension for vscode

This extension provides command to disable annoying default keybindings registered by other extensions.

## Commands

### `disable-default-keybindings`

This command adds settings to the bottom of your `keybindings.json` to disable keybindings registered by other extensions.

Following properties are supported to specify keybindings to preserve.

```jsonc
// specify extensionIds to preserve all of their keybindings.
//  "^vscode\\..+$" to keep vscode's default keybinginds
//  "^tuttieee\\.emacs-mcx$" to keep your emacs keybindings
"disable-default-keybinding.extensionsToPreserve": ["^vscode\\..+$", "^tuttieee\\.emacs-mcx$"]
// specify command name to preserve keybinding
"disable-default-keybinding.commandsToPreserve": ["^workbench\\.action\\.quickOpen$"]
```

### `restore-keybindings-backup`

`disable-default-keybinding.disable-default-keybindings` takes backup of `keybindings.json` before modifying the contents.
This commands restores `keybindings.json` from the backup.
It is useful if you mistakenly disabled too many keybindings.

### `delete-all-backups`

Delete all keybindings.json backups taken before overwriting setting.

## Settings

### runOnChange

If you set `disable-default-keybinding.runOnChange`, this plugin automatically checks the change of keybinding set when startup, installing/uninstalling/updating extensions.
If the change is detected, the plugin asks whether to update keybindings.json or not.

```jsonc
"disable-default-keybinding.runOnChange": true
```

### extensionsToPreserve

Specify extensionIds to preserve all of their keybindings.

```jsonc
// example
//  "^vscode\\..+$" to keep vscode's default keybinginds
//  "^tuttieee\\.emacs-mcx$" to keep your emacs keybindings
"disable-default-keybinding.extensionsToPreserve": ["^vscode\\..+$", "^tuttieee\\.emacs-mcx$"]
```

### commandsToPreserve

Specify command name to preserve keybinding

```jsonc
// example
"disable-default-keybinding.commandsToPreserve": ["^workbench\\.action\\.quickOpen$"]
```
