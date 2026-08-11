import { useEffect, useState } from "react";
import { AlertCircle, EyeOff, KeyRound, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, StatusBadge } from "@/components/WorkspaceUI";
import { WalletConnectDialog } from "@/components/WalletConnect";
import { formatAddress } from "@/lib/address";
import { api, type AuthUser } from "@/lib/api";
import { useApi } from "@/lib/useData";

export function SettingsPage({
  user,
  onUserChange,
  onOrgChange,
}: {
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
  onOrgChange: (name: string, memberCount: number) => void;
}) {
  const { data: org, refresh: refreshOrg } = useApi(() => api.org(), []);
  const [showWallet, setShowWallet] = useState(false);
  const [name, setName] = useState(user.name);
  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("");
  const [savedOrg, setSavedOrg] = useState(false);
  const paymentWalletReady = Boolean(user.wallet_address && user.wallet_verified);

  useEffect(() => {
    if (org?.org) {
      setOrgName(org.org.name);
      setCountry(org.org.country || "");
    }
  }, [org?.org?.name, org?.org?.country]);

  const saveName = async () => {
    if (!name.trim() || name.trim() === user.name) return;
    await api.updateMe({ name: name.trim() });
    onUserChange({ ...user, name: name.trim() });
  };

  const saveOrg = async () => {
    await api.updateOrg({ name: orgName.trim() || undefined, country: country.trim() || undefined });
    setSavedOrg(true);
    setTimeout(() => setSavedOrg(false), 3000);
    await refreshOrg();
    if (orgName.trim()) onOrgChange(orgName.trim(), org?.members.length ?? 0);
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Settings"
        title="Workspace preferences"
        description="Manage organization details, your profile, payment authorization wallet, and security boundaries."
        actions={<Badge variant="outline" className="gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" />Live API</Badge>}
      />

      <Tabs defaultValue="workspace" orientation="vertical" className="flex-col gap-6 lg:grid lg:grid-cols-[190px_minmax(0,1fr)]">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto p-0 lg:flex-col lg:items-stretch">
          <TabsTrigger value="workspace" className="justify-start px-3 py-2 lg:w-full"><Settings2 data-icon="inline-start" />Workspace</TabsTrigger>
          <TabsTrigger value="privacy" className="justify-start px-3 py-2 lg:w-full"><EyeOff data-icon="inline-start" />Privacy & security</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Shown in the workspace switcher and invitation messages.</CardDescription>
              <CardAction><span className="grid size-8 place-items-center rounded-lg bg-muted"><Settings2 className="size-4 text-muted-foreground" /></span></CardAction>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
                  <Input id="org-name" value={orgName} onChange={(event) => setOrgName(event.target.value)} />
                  <FieldDescription>Visible to all workspace members.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="org-country">Country</FieldLabel>
                  <Input id="org-country" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="e.g. Singapore" />
                  <FieldDescription>Optional headquarters location.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="button" onClick={saveOrg} disabled={!orgName.trim()}>{savedOrg ? "Saved ✓" : "Save organization"}</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your name as shown to the team.</CardDescription>
              <CardAction><span className="grid size-8 place-items-center rounded-lg bg-muted"><UserRound className="size-4 text-muted-foreground" /></span></CardAction>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="profile-name">Your name</FieldLabel>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
                  <Button variant="outline" type="button" onClick={saveName} disabled={!name.trim() || name.trim() === user.name}>Save profile</Button>
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment authorization wallet</CardTitle>
              <CardDescription>Used only to sign payroll payment intents after explicit review.</CardDescription>
              <CardAction><StatusBadge status={paymentWalletReady ? "ready" : "pending"} label={paymentWalletReady ? "Ownership verified" : "Not verified"} /></CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><WalletCards className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-medium">EVM wallet</strong>
                  <small className="mono-value block truncate text-xs text-muted-foreground">
                    {user.wallet_address ? formatAddress(user.wallet_address) : "Not connected"}
                  </small>
                </span>
                <Button type="button" onClick={() => setShowWallet(true)}>
                  <WalletCards data-icon="inline-start" />
                  {paymentWalletReady ? "Change wallet" : "Verify wallet"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication security</CardTitle>
              <CardDescription>Current local baseline for account credentials.</CardDescription>
              <CardAction><StatusBadge status="configured" /></CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><KeyRound className="size-4 text-muted-foreground" /></span>
                <span>
                  <strong className="block text-sm font-medium">Password policy</strong>
                  <small className="mt-1 block text-xs leading-5 text-muted-foreground">Minimum 8 characters · PBKDF2 with 150,000 iterations</small>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><EyeOff className="size-4 text-muted-foreground" /></span>
                <span>
                  <strong className="block text-sm font-medium">Role-scoped data access</strong>
                  <small className="mt-1 block text-xs leading-5 text-muted-foreground">Employees can access only their own payout method, history, and consent records.</small>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><ShieldCheck className="size-4 text-muted-foreground" /></span>
                <span>
                  <strong className="block text-sm font-medium">Payment authorization wallet</strong>
                  <small className="mt-1 block text-xs leading-5 text-muted-foreground">Live confidential payments require a verified admin wallet and server `PAYMENTS_MODE=live`.</small>
                </span>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle />
            <AlertTitle>Production hardening remains separate</AlertTitle>
            <AlertDescription>Production rollout still requires TOTP 2FA, session rotation, audit-grade logging, and verified operational credentials.</AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {showWallet && (
        <WalletConnectDialog
          user={user}
          title="Payment authorization wallet"
          description="Bind the EVM wallet that authorizes payroll payments. Ownership is proven by a one-time message that cannot initiate a transaction."
          onClose={() => setShowWallet(false)}
          onBound={(address, verified) => {
            setShowWallet(false);
            onUserChange({ ...user, wallet_address: address, wallet_verified: verified });
          }}
          onUnbound={() => onUserChange({ ...user, wallet_address: null, wallet_verified: false })}
        />
      )}
    </div>
  );
}
