import { headers } from "next/headers";
import { ShieldCheck, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { isPocketIdConfigured } from "@/lib/env";
import { SettingsCard, Field } from "@/components/settings-ui";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function AccountSettings() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsCard title="Account" icon={User} action={<SignOutButton />}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
            {(user?.name || user?.email || "M").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user?.name || "Signed in"}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </div>
        <Field label="Sign-in" state="ok" value="Active session" />
      </SettingsCard>

      <SettingsCard title="Authentication" icon={ShieldCheck}>
        <Field
          label="PocketID (OIDC)"
          state={isPocketIdConfigured ? "ok" : "off"}
          value={isPocketIdConfigured ? "enabled" : "not configured"}
        />
        <Field label="Public sign-up" state="off" value="disabled" />
        <Field label="Email / password" state="ok" value="break-glass admin" />
      </SettingsCard>
    </div>
  );
}
