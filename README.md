# vscode disable-default-keybinding extension

This extension provides command to disable annoying default keybindings registered by other extensions.

## Commands

### `disable-default-keybinding.disable-default-keybindings`

This command adds settings to your `keybindings.json` to disable keybindings registered by other extensions.

Following properties are supported to specify keybindings to preserve.

- `disable-default-keybinding.extensionsToPreserve`: specify extensionIds to preserve all of their keybindings.
  -  e.g. `["^vscode\\..+$", "^tuttieee\\.emacs-mcx$"]`
    - `"^vscode\\..+$"` to keep vscode's default keybinginds
    - `"^tuttieee\\.emacs-mcx$"` to keep your emacs keybindings
- `disable-default-keybinding.commandsToPreserve`: specify command name to preserve keybinding

### `disable-default-keybinding.restore-keybindings-backup`

`disable-default-keybinding.disable-default-keybindings` takes backup of `keybindings.json` before modifying the contents.
This commands restores `keybindings.json` from the backup.
It is useful if you mistakenly disabled too many keybindings.

### `disable-default-keybinding.delete-all-backups`

Delete all keybindings.json backups taken before overwriting setting.
