import * as vscode from "vscode";
import { STLogger } from "./logger";

export class SmartTabInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider {
  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    return [new vscode.InlineCompletionItem("SmartTab Completion!")];
  }
}

export function activate(context: vscode.ExtensionContext) {
  const logger = new STLogger();

  logger.debug("Extention Activated")

  const registration = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    new SmartTabInlineCompletionProvider(),
  );

  context.subscriptions.push(registration);
}

export function deactivate() { }
