import * as vscode from "vscode";

export class STInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private readonly MAX_PREFIX_LINES = 200;
  private readonly MAX_SUFFIX_LINES = 50;

  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 1000;

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (context.triggerKind !== vscode.InlineCompletionTriggerKind.Invoke) {
      return new Promise((resolve) => {
        this.debounceTimer = setTimeout(async () => {
          this.debounceTimer = null;
          const items = await this.doProvide(document, position, token);
          resolve(items);
        }, this.DEBOUNCE_DELAY);
      });
    }

    return this.doProvide(document, position, token);
  }

  private async doProvide(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    const ctx = this.getCursorContext(document, position);
    const prompt = `<|fim_prefix|>${ctx.before}<|fim_suffix|>${ctx.after}<|fim_middle|>`;
    const abortController = new AbortController();

    token.onCancellationRequested(() => abortController.abort());

    const completion = await this.getCompletion(prompt, abortController.signal);

    if (!completion.trim()) {
      return [];
    }

    return [
      new vscode.InlineCompletionItem(
        completion,
        new vscode.Range(position, position),
      ),
    ];
  }

  private getCursorContext(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): { before: string; after: string } {
    const startLine = Math.max(0, position.line - this.MAX_PREFIX_LINES);
    const endLine = Math.min(
      document.lineCount - 1,
      position.line + this.MAX_SUFFIX_LINES,
    );

    const prefixRange = new vscode.Range(
      new vscode.Position(startLine, 0),
      position,
    );
    const beforeText = document.getText(prefixRange);

    const suffixRange = new vscode.Range(
      position,
      new vscode.Position(
        endLine,
        document.lineAt(endLine).range.end.character,
      ),
    );
    const afterText = document.getText(suffixRange);

    const langHint = `// language: ${document.languageId}\n\n`;
    const fileHint = `// file: ${document.fileName.split("/").pop()}\n`;

    return { before: fileHint + langHint + beforeText, after: afterText };
  }

  private async getCompletion(
    prompt: string,
    signal: AbortSignal,
  ): Promise<string> {
    const url = "http://localhost:11434/api/generate";
    const body = {
      stream: false,
      prompt: prompt,
      model: "qwen2.5-coder:1.5b-base",
      raw: true,
      options: {
        temperature: 0.1,
        num_predict: 64,
        stop: ["<|fim_suffix|>", "<|im_end|>", "\n\n"],
      },
    };

    try {
      const response = await fetch(url, {
        signal,
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        return "";
      }
      const json = (await response.json()) as { response: string };
      return json.response;
    } catch (e) {
      return "";
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const registration = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    new STInlineCompletionProvider(),
  );
  context.subscriptions.push(registration);
}

export function deactivate() {}
