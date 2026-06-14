// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

const runningCommands = new Map<vscode.TerminalShellExecution, number>();

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );

  return response.json();
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("areWeThereYet");
  const BOT_TOKEN = config.get<string>("botToken")!;
  const CHAT_ID = config.get<string>("chatId")!;
  const minimumDurationSeconds = config.get<number>(
    "minimumDurationSeconds",
    30,
  )!;

  if (!BOT_TOKEN || !CHAT_ID) {
    vscode.window.showWarningMessage(
      "AreWeThereYet is not configured. Set botToken and chatId in Settings.",
    );
  }
  try {
    await sendTelegramMessage(
      BOT_TOKEN,
      CHAT_ID,
      "🚀 AreWeThereYet extension activated!",
    );
  } catch (err) {
    console.error("Failed to send activation notification:", err);
  }

  const testNotification = vscode.commands.registerCommand(
    "are-we-there-yet.testNotification",
    async () => {
      if (!BOT_TOKEN || !CHAT_ID) {
        vscode.window.showErrorMessage("Configure botToken and chatId first.");
        return;
      }
      try {
        await sendTelegramMessage(
          BOT_TOKEN,
          CHAT_ID,
          `🐢 Are We There Yet?

🧪 Test Notification

If you received this message,
your Telegram integration is working correctly.`,
        );

        vscode.window.showInformationMessage("Test notification sent.");
      } catch (err) {
        vscode.window.showErrorMessage("Failed to send test notification.");
        console.error(err);
      }
    },
  );

  const openSettings = vscode.commands.registerCommand(
    "are-we-there-yet.openSettings",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "Are We There Yet",
      );
    },
  );

  context.subscriptions.push(openSettings);

  context.subscriptions.push(testNotification);

  vscode.window.showInformationMessage("AreWeThereYet activated!");
  context.subscriptions.push(
    vscode.window.onDidStartTerminalShellExecution((event) => {
      const command = event.execution.commandLine.value;
      console.log("START:", command);
      runningCommands.set(event.execution, Date.now());
    }),
  );

  context.subscriptions.push(
    vscode.window.onDidEndTerminalShellExecution(async (event) => {
      const command = event.execution.commandLine.value;
      const exitCode = event.exitCode;
      const startTime = runningCommands.get(event.execution);
      if (!startTime) {
        return;
      }

      const durationMs = Date.now() - startTime;
      if (durationMs < minimumDurationSeconds * 1000) {
        runningCommands.delete(event.execution);
        return;
      }
      console.log(
        "END:",
        command,
        "exit:",
        exitCode,
        "duration:",
        formatDuration(durationMs),
      );
      const success = exitCode === 0;
      const status = success ? "✅ Success" : "❌ Failed";
      runningCommands.delete(event.execution);
      await sendTelegramMessage(
        BOT_TOKEN,
        CHAT_ID,
        `🐢 Are We There Yet?

Yes.

Status:
${status}

Command:
${command}

Duration:
${formatDuration(durationMs)}

Exit Code:
${exitCode}`,
      );
    }),
  );
}
// This method is called when your extension is deactivated
export function deactivate() {}
