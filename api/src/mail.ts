// Email delivery via Resend. Falls back to a mock that returns the invite link
// (visible in the API response for local development when MOCK_EMAIL=true).

import type { Env } from "./types";

export interface InviteMailInput {
  to: string;
  inviteUrl: string;
  orgName: string;
  inviterName: string;
  role: string;
}

export async function sendInviteEmail(env: Env, input: InviteMailInput): Promise<{ ok: boolean; mock?: boolean; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  const mock = env.MOCK_EMAIL === "true" || !apiKey;
  if (mock) {
    return { ok: true, mock: true };
  }
  try {
    const from = env.SENDER_EMAIL || "SalaryFlow <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `${input.inviterName} invited you to join ${input.orgName} on SalaryFlow`,
        html: `
          <p>Hi,</p>
          <p><strong>${input.inviterName}</strong> invited you to join <strong>${input.orgName}</strong> on SalaryFlow as a ${input.role === "admin" ? "team administrator" : "team member"}.</p>
          <p><a href="${input.inviteUrl}">Accept the invitation</a></p>
          <p>This link expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>
        `,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend returned ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
