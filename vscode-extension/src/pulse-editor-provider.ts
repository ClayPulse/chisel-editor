import * as vscode from "vscode";
import { getNonce } from "./util";

/**
 * Provider for cat scratch editors.
 *
 * Cat scratch editors are used for `.cscratch` files, which are just json files.
 * To get started, run this extension and open an empty `.cscratch` file in VS Code.
 *
 * This provider demonstrates:
 *
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
export class PulseEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(
    context: vscode.ExtensionContext,
    setIsEditInPulse: (isEditInPulse: boolean) => void,
  ): vscode.Disposable {
    const provider = new PulseEditorProvider(context, setIsEditInPulse);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      PulseEditorProvider.viewType,
      provider,
    );
    return providerRegistration;
  }

  public static readonly viewType = "pulse.editorWebview";
  private readonly pulse_editor = "https://editor.claypulse.ai";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly setIsEditInPulse: (isEditInPulse: boolean) => void,
  ) {}

  /**
   * Called when our custom editor is opened.
   *
   *
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const theme =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
        ? "light"
        : "dark";
    webviewPanel.webview.html = await this.getHtmlForWebview(
      webviewPanel.webview,
      theme,
    );

    // Receive message from the webview
    webviewPanel.webview.onDidReceiveMessage((e) => {
      if (e.command === "switchToTextEditor") {
        vscode.commands.executeCommand("pulse.editInVSCode");
      } else if (e.command === "updateVSCodeText") {
        const text = e.text;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          document.uri,
          new vscode.Range(0, 0, document.lineCount, 0),
          text,
        );
        vscode.workspace.applyEdit(edit);
      } else if (e.command === "log") {
        vscode.window.showInformationMessage(e.message);
      } else if (e.command === "pulseReady") {
        webviewPanel.webview.postMessage({
          command: "openFile",
          path: document.uri.toString(),
          text: document.getText(),
          from: "extension",
        });
      }
    });

    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        vscode.commands.executeCommand(
          "setContext",
          "pulse.isEditInPulse",
          true,
        );
        this.setIsEditInPulse(true);
      }
    });

    // Set isEditInPulse context to true when the editor is opened
    vscode.commands.executeCommand("setContext", "pulse.isEditInPulse", true);
    this.setIsEditInPulse(true);

    // Hook up event handlers so that we can synchronize the webview with the text document.
    //
    // The text document acts as our model, so we have to sync change in the document to our
    // editor and sync changes in the editor back to the document.
    //
    // Remember that a single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)
    function updateWebview() {
      if (webviewPanel.active) {
        webviewPanel.webview.postMessage({
          command: "updatePulseText",
          text: document.getText(),
          from: "extension",
        });
      }
    }
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      },
    );

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private async getHtmlForWebview(
    webview: vscode.Webview,
    theme: string,
  ): Promise<string> {
    // Local path to script and css for the webview
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "pulse-editor.css",
      ),
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; frame-src ${this.pulse_editor};">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

        <link href="${styleUri}" rel="stylesheet">

				<title>Pulse Editor</title>
        <script nonce="${nonce}">
          (function() {
            const vscode = acquireVsCodeApi();
  
            // On keydown ctrl+alt+s, send a message to the extension
            window.addEventListener('keydown', (e) => {
              if (e.ctrlKey && e.altKey && e.code === 'KeyS') {
                vscode.postMessage({
                  command: 'switchToTextEditor'
                });
                console.log("switchToTextEditor from webview keydown listener");
              }
            });
  
            // Add listener for messages from the iframe content
            window.addEventListener('message', (e) => {
              const message = e.data;
              const from = message.from;
              if(from === 'extension') {
                if (message.command === 'updatePulseText') {
                  const text = message.text;
                  // Pass the text to the iframe
                  const iframe = document.getElementById('iframe-pulse');
                  iframe.contentWindow.postMessage({
                    command: 'updatePulseText',
                    text
                  }, '*');
                  console.log("updatePulseText from webview listener");
                } 
                else if (message.command === 'openFile') {
                  const path = message.path;
                  const text = message.text;
                  const iframe = document.getElementById('iframe-pulse');
                  iframe.contentWindow.postMessage({
                    command: 'openFile',
                    path,
                    text
                  }, '*');
                  console.log("openFile from webview listener");
                }
              }
              else if (from === 'pulse') {
                if (message.command === 'switchToTextEditor') {
                  vscode.postMessage({
                    command: 'switchToTextEditor'
                  });
                  console.log("switchToTextEditor from iframe listener");
                }
                else if(message.command === 'updateVSCodeText') {
                  const text = message.text;
                  vscode.postMessage({
                    command: 'updateVSCodeText',
                    text
                    });
                  console.log("updateVsCodeText from iframe listener");
                }
                else if(message.command === 'pulseReady') {
                  vscode.postMessage({
                    command: 'pulseReady'
                  });
                  console.log("pulseReady from iframe listener");
                }
              }
              else {
                vscode.postMessage({
                  command: 'log',
                  message: 'Invalid message from iframe'
                });
              }
            });

            window.focus();
        }())
        </script>
			</head>
			<body>
          <iframe id="iframe-pulse" src="${this.pulse_editor}?vscode=true&theme=${theme}"></iframe>
			</body>
			</html>`;
  }
}
