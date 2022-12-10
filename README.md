[![Test](https://github.com/cormoran/vscode-disable-default-keybinding/actions/workflows/test.yml/badge.svg)](https://github.com/cormoran/vscode-disable-default-keybinding/actions/workflows/test.yml)

# Disable Default Keybindings Extension for vscode

This extension provides command to disable annoying default keybindings registered by other extensions.

## Command `disable-default-keybindings`

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

## Command `restore-keybindings-backup`

`disable-default-keybinding.disable-default-keybindings` takes backup of `keybindings.json` before modifying the contents.
This commands restores `keybindings.json` from the backup.
It is useful if you mistakenly disabled too many keybindings.

## Command `delete-all-backups`

Delete all keybindings.json backups taken before overwriting setting.
