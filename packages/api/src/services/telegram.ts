import { env } from "@rem-viet/env/server";

type TelegramConfig = {
  botToken: string;
  chatId: string;
};

function telegramConfig(): TelegramConfig | null {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const botToken = runtimeEnv.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = runtimeEnv.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    return null;
  }

  return { botToken, chatId };
}

export async function sendTelegramMessage(text: string) {
  const config = telegramConfig();

  if (!config) {
    return { skipped: true };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }

  return { skipped: false };
}

export async function notifyTelegram(text: string) {
  try {
    return await sendTelegramMessage(text);
  } catch (error) {
    console.warn(error);
    return { skipped: false, error };
  }
}
