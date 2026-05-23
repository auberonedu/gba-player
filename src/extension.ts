import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "gba-player" is now active!');

	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			'gba-player.gba',
			new GbaEditorProvider(context),
			{
				webviewOptions: { retainContextWhenHidden: true },
				supportsMultipleEditorsPerDocument: false,
			}
		)
	);
}

class GbaEditorProvider implements vscode.CustomReadonlyEditorProvider {
	constructor(private readonly context: vscode.ExtensionContext) {}

	openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
		return { uri, dispose: () => {} };
	}

	resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewPanel: vscode.WebviewPanel
	): void {
		const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media');

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [mediaRoot],
		};

		const ejsBase = webviewPanel.webview.asWebviewUri(
			vscode.Uri.joinPath(mediaRoot, 'emulatorjs')
		);

		webviewPanel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>GBA Preview</title>
	<style>
		body { margin: 0; background: #000; color: #fff; font-family: sans-serif; }
		#game { width: 100vw; height: 100vh; }
	</style>
</head>
<body>
	<div id="game"></div>
	<script>
		window.EJS_player = '#game';
		window.EJS_core = 'gba';
		window.EJS_pathtodata = '${ejsBase}/';
		// No ROM yet — we'll wire that up next.
		window.EJS_gameUrl = '';
	</script>
	<script src="${ejsBase}/loader.js"></script>
</body>
</html>`;
	}
}

export function deactivate() {}