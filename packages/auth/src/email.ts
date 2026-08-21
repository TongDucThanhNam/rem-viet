export type AuthEmailDeliveryResult = Readonly<{
  status: "sent" | "skipped" | "failed";
  providerId?: string;
  error?: string;
}>;

export type AuthEmailRuntime = Readonly<{
  values?: Readonly<Record<string, string | undefined>>;
  fetch?: typeof fetch;
}>;

function runtimeValues() {
  return process.env as Readonly<Record<string, string | undefined>>;
}

export function isAuthEmailDeliveryConfigured(
  values: Readonly<Record<string, string | undefined>> = runtimeValues(),
) {
  return Boolean(values.RESEND_API_KEY?.trim() && values.EMAIL_FROM?.trim());
}

/** Server-only transactional delivery; tokens stay in the request body only. */
export async function sendAuthEmail(
  input: Readonly<{ to: string; subject: string; text: string }>,
  runtime?: AuthEmailRuntime,
): Promise<AuthEmailDeliveryResult> {
  const values = runtime?.values ?? runtimeValues();
  const apiKey = values.RESEND_API_KEY?.trim();
  const from = values.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { status: "skipped" };

  try {
    const response = await (runtime?.fetch ?? fetch)(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
        }),
      },
    );
    if (!response.ok)
      return {
        status: "failed",
        error: `Email provider returned ${response.status}`,
      };
    const payload = (await response.json().catch(() => null)) as {
      id?: unknown;
    } | null;
    return {
      status: "sent",
      ...(typeof payload?.id === "string" ? { providerId: payload.id } : {}),
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Email delivery failed",
    };
  }
}
