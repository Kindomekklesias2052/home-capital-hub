const KEY = "kinship-pending-invite";

export function savePendingInvite(token: string) {
  localStorage.setItem(KEY, token);
}

export function takePendingInvite(): string | null {
  const t = localStorage.getItem(KEY);
  if (t) localStorage.removeItem(KEY);
  return t && /^[a-f0-9]{64}$/.test(t) ? t : null;
}

/** After sign-in, go to a pending invite if one was opened, else the dashboard. */
export function goAfterSignIn(navigate: (opts: any) => unknown) {
  const token = takePendingInvite();
  if (token) void navigate({ to: "/invite/$token", params: { token } });
  else void navigate({ to: "/dashboard" });
}
