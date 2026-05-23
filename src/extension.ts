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

	async resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewPanel: vscode.WebviewPanel
	): Promise<void> {
		const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media');

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [mediaRoot],
		};

		const ejsBase = webviewPanel.webview.asWebviewUri(
			vscode.Uri.joinPath(mediaRoot, 'emulatorjs')
		);

		webviewPanel.webview.html = this.getHtml(webviewPanel.webview, ejsBase.toString());

		// Read the ROM and base64-encode it for the postMessage trip — Uint8Arrays
		// don't survive structured clone reliably across the VS Code webview boundary.
		const romBytes = await vscode.workspace.fs.readFile(document.uri);
		const fileName = document.uri.path.split('/').pop() ?? 'rom.gba';
		const romBase64 = Buffer.from(romBytes).toString('base64');

		webviewPanel.webview.postMessage({
			type: 'loadRom',
			fileName,
			base64: romBase64,
		});
	}

	private getHtml(webview: vscode.Webview, ejsBase: string): string {
		const csp = `
			default-src 'none';
			script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval' blob:;
			style-src ${webview.cspSource} 'unsafe-inline';
			img-src ${webview.cspSource} data: blob:;
			media-src ${webview.cspSource} blob:;
			connect-src ${webview.cspSource} blob: data:;
			worker-src blob:;
			child-src blob:;
			font-src ${webview.cspSource};
		`.replace(/\s+/g, ' ').trim();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<title>GBA Preview</title>
	<style>
		body { margin: 0; background: #000; color: #fff; font-family: sans-serif; }
		#game { width: 100vw; height: 100vh; }
	</style>
</head>
<body>
	<div id="game"></div>
	<script>
		window.addEventListener('message', (event) => {
			const msg = event.data;
			if (msg.type !== 'loadRom') return;

			// Decode base64 → Uint8Array
			const binary = atob(msg.base64);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}

			console.log('ROM bytes:', bytes.length, 'first 4:',
				Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' '));

			const blob = new Blob([bytes], { type: 'application/octet-stream' });
			const blobUrl = URL.createObjectURL(blob);

			window.EJS_player = '#game';
			window.EJS_core = 'gba';
			window.EJS_pathtodata = '${ejsBase}/';
			window.EJS_gameUrl = blobUrl;
			window.EJS_gameName = msg.fileName.replace(/\.gba$/i, '');
			window.EJS_paths = {
				"version.json": "${ejsBase}/version.json",
			};

			// Load the EmulatorJS bootloader now that all the globals are set.
			const script = document.createElement('script');
			script.src = '${ejsBase}/loader.js';
			document.body.appendChild(script);
		});
	</script>
</body>
</html>`;
	}
}

export function deactivate() {}