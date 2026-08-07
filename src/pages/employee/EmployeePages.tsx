import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  EyeOff,
  FileSignature,
  LockKeyhole,
  Save,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyPanel, MetricCard, PageHeader, StatusBadge, TokenCell } from "@/components/WorkspaceUI";
import { api, ApiError, type AuthUser } from "@/lib/api";
import { isValidEthereumAddress } from "@/lib/erc191";
import { formatTokenAmount, useApi } from "@/lib/useData";

function EmployeeFrame({ children }: { children: React.ReactNode }) {
  return <div className="page-container">{children}</div>;
}

export function EmployeeHomePage({ user, orgName }: { user: AuthUser; orgName: string }) {
  const { data: payout, loading: payoutLoading } = useApi(() => api.myPayout(), []);
  const { data: records, loading: recordsLoading } = useApi(() => api.myRecords(), []);

  useEffect(() => {
    document.title = "SalaryFlow · My pay";
  }, []);

  const employee = payout?.payout;
  const recent = records?.records[0];

  return (
    <EmployeeFrame>
      <PageHeader
        eyebrow="My pay"
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Review your next net payment, payout destination, and private payment history."
        actions={<Badge variant="outline">{orgName || "Workspace"} · {employee?.role_title || "Team member"}</Badge>}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Net amount" value={employee ? formatTokenAmount(employee.amount_minor) : "—"} helper={employee?.token ?? "USDC"} icon={<CalendarDays />} loading={payoutLoading} />
        <MetricCard label="Stablecoin" value={employee?.token ?? "USDC"} helper="Your selected payout asset" icon={<WalletCards />} loading={payoutLoading} />
        <MetricCard label="Network" value={employee?.network ?? "Base"} helper="Selected destination chain" icon={<ShieldCheck />} loading={payoutLoading} />
        <MetricCard label="Payout status" value={employee?.status === "ready" ? "Ready" : "Pending"} helper={employee?.status === "ready" ? "Wallet ownership verified" : "Verification required"} icon={<CheckCircle2 />} loading={payoutLoading} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Where your pay is now</CardTitle>
            <CardDescription>Status updates appear here as payroll progresses.</CardDescription>
            <CardAction><StatusBadge status={recent?.status ?? "pending"} label={recent?.status === "paid" ? "Paid" : "Waiting"} /></CardAction>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-4 md:grid-cols-3">
              <li className="relative rounded-lg border bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
                <span className="mb-3 grid size-7 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-3.5" /></span>
                <strong className="block text-sm font-medium">Net pay confirmed</strong>
                <small className="mt-1 block text-xs leading-5 text-muted-foreground">{recent ? `${formatTokenAmount(recent.amount_minor)} ${recent.token}` : "Amount set by payroll"}</small>
              </li>
              <li className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <span className="mb-3 grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
                <strong className="block text-sm font-medium">Waiting for payment</strong>
                <small className="mt-1 block text-xs leading-5 text-muted-foreground">Your employer completes the reviewed payment flow.</small>
              </li>
              <li className="rounded-lg border p-4">
                <span className="mb-3 grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">3</span>
                <strong className="block text-sm font-medium">Pay received</strong>
                <small className="mt-1 block text-xs leading-5 text-muted-foreground">A private receipt appears after confirmation.</small>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout destination</CardTitle>
            <CardDescription>Your current verified receiving method.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TokenCell token={employee?.token ?? "USDC"} network={employee?.network ?? "Base"} />
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Wallet address</p>
              <p className="mono-value mt-1 text-sm">{employee?.endpoint ? `${employee.endpoint.slice(0, 8)}…${employee.endpoint.slice(-6)}` : "Not set"}</p>
            </div>
            <StatusBadge status={employee?.status ?? "pending"} label={employee?.status === "ready" ? "Ready to receive" : "Awaiting verification"} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><EyeOff className="size-5" /></span>
          <div className="flex-1">
            <h2 className="font-heading text-base font-medium">Your pay is yours alone</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Coworkers cannot see your amount or wallet. Employer views mask addresses, and each employee account is scoped to its own records.</p>
          </div>
          <Badge variant="secondary">Private by default</Badge>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle />
        <AlertTitle>Payment execution remains disabled</AlertTitle>
        <AlertDescription>SalaryFlow is connected to the local API, but live settlement stays locked while production reconciliation is completed.</AlertDescription>
      </Alert>
      {recordsLoading && <span className="sr-only">Loading payment history</span>}
    </EmployeeFrame>
  );
}

export function EmployeeHistoryPage() {
  const { data, loading } = useApi(() => api.myRecords(), []);
  const records = data?.records ?? [];

  return (
    <EmployeeFrame>
      <PageHeader eyebrow="Payment history" title="My pay history" description="Review each net amount, destination network, and settlement state." />
      {loading ? (
        <Card><CardContent className="grid h-40 place-items-center text-sm text-muted-foreground">Loading payment history…</CardContent></Card>
      ) : records.length === 0 ? (
        <EmptyPanel title="No payments yet" description="Your private payment records appear here once payroll is sent." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Only your account can view these records.</CardDescription>
            <CardAction><Badge variant="secondary">{records.length} records</Badge></CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader><TableRow><TableHead className="pl-4">Pay period</TableHead><TableHead>Net amount</TableHead><TableHead>Network</TableHead><TableHead>Status</TableHead><TableHead className="pr-4">Intent</TableHead></TableRow></TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="pl-4 font-medium">{record.employee_name}</TableCell>
                    <TableCell className="font-medium tabular-nums">{formatTokenAmount(record.amount_minor)} {record.token}</TableCell>
                    <TableCell><TokenCell token={record.token} network={record.network} /></TableCell>
                    <TableCell><StatusBadge status={record.status} /></TableCell>
                    <TableCell className="mono-value pr-4 text-xs text-muted-foreground">{record.intent_hash ? `${record.intent_hash.slice(0, 14)}…` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </EmployeeFrame>
  );
}

export function EmployeePayoutPage() {
  const { data, refresh } = useApi(() => api.myPayout(), []);
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("Base");
  const [endpoint, setEndpoint] = useState("");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const employee = data?.payout;

  useEffect(() => {
    if (employee) {
      setToken(employee.token);
      setNetwork(employee.network);
      setEndpoint(employee.endpoint || "");
    }
  }, [employee?.id, employee?.token, employee?.network, employee?.endpoint]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await api.updatePayout({ token, network, endpoint });
      setSaved(true);
      setNotice("Payout details updated. Verify wallet ownership before the next payment.");
      await refresh();
      setTimeout(() => setSaved(false), 4000);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to save payout details");
    }
  };

  const connectedAddressMatches = Boolean(address && address.toLowerCase() === endpoint.trim().toLowerCase());
  const payoutConfigurationMatches = Boolean(
    employee
    && employee.token === token
    && employee.network === network
    && employee.endpoint.trim().toLowerCase() === endpoint.trim().toLowerCase(),
  );
  const ownershipVerified = Boolean(
    payoutConfigurationMatches
    && employee?.status === "ready"
    && employee.payout_verified_at,
  );

  const useConnectedAddress = () => {
    if (!address) return;
    setEndpoint(address);
    setSaved(false);
    setError("");
    const alreadyVerified = Boolean(
      employee?.status === "ready"
      && employee.payout_verified_at
      && employee.token === token
      && employee.network === network
      && employee.endpoint.trim().toLowerCase() === address.toLowerCase(),
    );
    setNotice(alreadyVerified
      ? "This connected wallet is already verified."
      : "Connected wallet selected. Verify ownership to save and activate it.");
  };

  const changeConnectedWallet = () => {
    disconnect();
    setEndpoint("");
    setSaved(false);
    setError("");
    setNotice("Wallet disconnected. Connect the wallet you want to use for payouts.");
  };

  const verifyWallet = async () => {
    if (ownershipVerified) return;
    setError("");
    setNotice("");
    if (!isValidEthereumAddress(endpoint.trim())) {
      setError("Enter a valid EVM payout address first.");
      return;
    }
    if (!address || !connectedAddressMatches) {
      setError("Connect the same wallet address entered above before verifying.");
      return;
    }

    setVerifying(true);
    try {
      const challenge = await api.createPayoutChallenge({ token, network, endpoint: endpoint.trim() });
      const signature = await signMessageAsync({ message: challenge.message });
      const result = await api.verifyPayout({ challengeId: challenge.challengeId, signature });
      setEndpoint(result.payout.endpoint);
      setNotice("Wallet ownership verified. This payout method is ready.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Wallet verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <EmployeeFrame>
      <PageHeader eyebrow="Payout method" title="Where your pay goes" description="Choose your stablecoin, destination network, and verified wallet." />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <form onSubmit={save}>
          <Card>
            <CardHeader>
              <CardTitle>Current payout method</CardTitle>
              <CardDescription>Changes apply only to payroll runs that have not been sent.</CardDescription>
              <CardAction><StatusBadge status={ownershipVerified ? "ready" : "update_required"} label={ownershipVerified ? "Ready" : "Needs verification"} /></CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field>
                <FieldLabel>Stablecoin</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {["USDC", "USDT"].map((value) => (
                    <Button key={value} type="button" variant={token === value ? "default" : "outline"} className="h-11 justify-start" onClick={() => { setToken(value); setSaved(false); setNotice(""); }}>
                      <span className="grid size-6 place-items-center rounded-full bg-background/15 text-xs">{value === "USDC" ? "$" : "₮"}</span>
                      {value}
                    </Button>
                  ))}
                </div>
                <FieldDescription>The stablecoin deposited to your wallet.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Destination network</FieldLabel>
                <Select value={network} onValueChange={(value) => { setNetwork(value); setNotice(""); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Base", "Arbitrum", "Polygon", "Optimism", "Ethereum", "BNB Chain"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
                <FieldDescription>Your wallet must support both the asset and network.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="employee-address">Wallet address</FieldLabel>
                <Input id="employee-address" value={endpoint} onChange={(event) => { setEndpoint(event.target.value); setNotice(""); }} placeholder="0x…" autoComplete="off" />
                <FieldDescription className="flex items-center gap-1"><LockKeyhole className="size-3" />Employer views show only {endpoint.slice(0, 6) || "…"}…{endpoint.slice(-4) || "…"}</FieldDescription>
              </Field>

              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span>
                  <div className="flex-1">
                    <strong className="block text-sm font-medium">Verify wallet ownership</strong>
                    <small className="mt-1 block text-xs leading-5 text-muted-foreground">Sign a one-time message. It cannot move funds or authorize payment.</small>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  {ownershipVerified ? (
                    <>
                      <span className="mono-value min-w-0 flex-1 truncate text-xs text-emerald-700">
                        {employee?.endpoint.slice(0, 10)}…{employee?.endpoint.slice(-8)} · address verified
                      </span>
                      <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="size-4" aria-hidden="true" />Ownership verified
                      </span>
                      <Button variant="ghost" type="button" onClick={changeConnectedWallet}>Change wallet</Button>
                    </>
                  ) : !isConnected ? connectors.map((connector) => (
                    <Button
                      variant="outline"
                      type="button"
                      key={connector.uid}
                      onClick={() => {
                        setError("");
                        setNotice("");
                        connect({ connector });
                      }}
                    >
                      Connect {connector.name}
                    </Button>
                  )) : (
                    <>
                      <span className={`mono-value min-w-0 flex-1 truncate text-xs ${connectedAddressMatches ? "text-emerald-700" : "text-amber-700"}`}>
                        {address?.slice(0, 10)}…{address?.slice(-8)} · {connectedAddressMatches ? "address matches" : "does not match"}
                      </span>
                      {connectedAddressMatches ? (
                        <Button variant="outline" type="button" disabled={verifying} onClick={verifyWallet}>
                          <ShieldCheck data-icon="inline-start" />{verifying ? "Waiting…" : "Verify ownership"}
                        </Button>
                      ) : (
                        <Button variant="outline" type="button" onClick={useConnectedAddress}>Use this address</Button>
                      )}
                      <Button variant="ghost" type="button" disabled={verifying} onClick={changeConnectedWallet}>Change wallet</Button>
                    </>
                  )}
                </div>
                {!ownershipVerified && isConnected && !connectedAddressMatches && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Use the connected address above, or disconnect it and connect a different wallet. Either choice requires a new ownership signature.
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <span className={`flex items-center gap-1 text-xs text-emerald-700 transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}><Check className="size-3.5" />Saved</span>
              <Button type="submit" disabled={verifying}><Save data-icon="inline-start" />Save payout method</Button>
            </CardFooter>
          </Card>
        </form>

        <Card className="h-fit">
          <CardHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><WalletCards className="size-5" /></span>
            <CardTitle>Check before you save</CardTitle>
            <CardDescription>A wrong chain or address can delay or permanently lose funds.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {["Your wallet supports the selected asset and network.", "You connect the exact same address and sign the ownership challenge.", "You re-check the masked destination before the next payroll."].map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-6">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{index + 1}</span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {notice && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><CheckCircle2 /><AlertTitle>Payout method updated</AlertTitle><AlertDescription className="text-emerald-800">{notice}</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to update payout method</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    </EmployeeFrame>
  );
}

export function EmployeeDocumentsPage({ user }: { user: AuthUser }) {
  const { data, refresh } = useApi(() => api.myConsent(), []);
  const [notice, setNotice] = useState("");

  const sign = async () => {
    await api.signConsent({ consent: "stablecoin-payout", version: "1", acceptedAt: new Date().toISOString(), employeeId: user.id });
    setNotice("Consent recorded for this session.");
    await refresh();
  };

  return (
    <EmployeeFrame>
      <PageHeader eyebrow="Documents and proof" title="My payroll documents" description="Consent and payout evidence live together in this private workspace." actions={<Badge variant="outline"><EyeOff data-icon="inline-start" />Private to you</Badge>} />
      <Card>
        <CardHeader>
          <CardTitle>Stablecoin payout consent</CardTitle>
          <CardDescription>Authorizes SalaryFlow to deliver your net pay in the selected stablecoin.</CardDescription>
          <CardAction><StatusBadge status={data?.signed ? "signed" : "pending"} label={data?.signed ? "Signed" : "Unsigned"} /></CardAction>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/20 p-5 text-sm leading-7 text-muted-foreground">
            Your employment agreement remains denominated in USD. This consent authorizes delivery of net amounts in USDC or USDT to your verified wallet. Deposit and withdrawal activity on public chains remains visible where required by those networks.
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-xs text-muted-foreground">
            {data?.signed && data.signedAt ? `Signed ${new Date(data.signedAt).toLocaleString()}` : "A signature is still required."}
          </span>
          {!data?.signed && <Button type="button" onClick={sign}><FileSignature data-icon="inline-start" />Review and sign consent</Button>}
        </CardFooter>
      </Card>

      {notice && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><CheckCircle2 /><AlertTitle>Consent recorded</AlertTitle><AlertDescription className="text-emerald-800">{notice}</AlertDescription></Alert>}
      <Alert>
        <AlertCircle />
        <AlertTitle>Local evidence baseline</AlertTitle>
        <AlertDescription>Production rollout will integrate a compliant e-signature provider and trusted timestamps.</AlertDescription>
      </Alert>
    </EmployeeFrame>
  );
}
