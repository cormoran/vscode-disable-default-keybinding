import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Disable all keybindings', async () => {
		await vscode.commands.executeCommand('disable-default-keybinding.disable-extension-keybindings');
		await vscode.commands.executeCommand('disable-default-keybinding.delete-all-backups');
	});
});
