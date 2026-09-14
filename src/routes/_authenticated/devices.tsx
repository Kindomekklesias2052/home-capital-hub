import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Smartphone, Trash2, ShieldOff, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ledger/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDeviceMutations, useDevices, type DeviceRow } from "@/hooks/useLedger";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({
    meta: [
      { title: "Paired devices — Kinship Capital" },
      {
        name: "description",
        content: "Pair an Android phone so M-PESA and bank messages flow securely into your ledgers.",
      },
      { property: "og:title", content: "Paired devices — Kinship Capital" },
      { property: "og:description", content: "Pair an Android phone to capture transactions automatically." },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const { data: devices = [] } = useDevices();
  const { createPairing, activate, revoke, remove } = useDeviceMutations();
  const [name, setName] = useState("");
  const [justCreated, setJustCreated] = useState<DeviceRow | null>(null);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  return (
    <AppShell title="Devices" subtitle="Automatic capture from your phone">
      <div className="space-y-5">
        <section className="surface p-4">
          <h2 className="text-sm font-semibold">How automatic capture works</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A browser cannot read SMS. Instead, the companion Android app listens for messages from
            M-PESA, KCB and Equity and posts them to your private ingestion endpoint, which parses
            and files each transaction. Pair a device below to get its secret token.
          </p>
          <code className="numeric mt-3 block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
            POST {typeof window !== "undefined" ? window.location.origin : ""}/api/public/transactions/sms
          </code>
        </section>

        <form
          className="surface grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            createPairing.mutate(name, {
              onSuccess: (device) => {
                setJustCreated(device);
                setName("");
                toast.success("Pairing code generated");
              },
              onError: (err) => toast.error((err as Error).message),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="device-name">Device name</Label>
            <Input
              id="device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aquila's Android"
            />
          </div>
          <Button type="submit" disabled={createPairing.isPending}>
            Generate pairing code
          </Button>
        </form>

        {justCreated ? (
          <section className="surface border-primary/40 p-4">
            <h2 className="text-sm font-semibold">Pair “{justCreated.device_name}”</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the code in the Android app, then keep the token secret — it authenticates every
              upload. The code expires in 15 minutes.
            </p>
            <div className="mt-3 space-y-2">
              <Row label="Pairing code" value={justCreated.pairing_code ?? ""} onCopy={copy} />
              <Row label="Device token" value={justCreated.device_token} onCopy={copy} mono />
            </div>
            <Button
              className="mt-3 w-full"
              onClick={() =>
                activate.mutate(justCreated.id, {
                  onSuccess: () => {
                    toast.success("Device activated");
                    setJustCreated(null);
                  },
                })
              }
            >
              <CheckCircle2 className="mr-2 size-4" /> Mark as paired
            </Button>
          </section>
        ) : null}

        {devices.length === 0 ? (
          <EmptyState title="No devices paired" description="Generate a pairing code to connect your Android phone." />
        ) : (
          <ul className="space-y-3">
            {devices.map((d) => (
              <li key={d.id} className="surface flex items-start gap-3 p-4">
                <Smartphone className="mt-0.5 size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {d.device_name}
                    <Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.paired_at ? `Paired ${formatRelative(d.paired_at)}` : "Awaiting pairing"}
                    {d.last_seen_at ? ` · last upload ${formatRelative(d.last_seen_at)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {d.status === "active" ? (
                    <Button variant="ghost" size="icon" aria-label="Revoke device" onClick={() => revoke.mutate(d.id)}>
                      <ShieldOff className="size-4" />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" aria-label="Remove device" onClick={() => remove.mutate(d.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="surface p-4">
          <h2 className="text-sm font-semibold">Push notifications</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Each paired device stores a push token field, so Firebase Cloud Messaging can be switched
            on later to alert you the moment a transaction needs confirmation.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  onCopy: (v: string, label: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={mono ? "numeric truncate text-xs" : "text-lg font-semibold tracking-[0.3em]"}>{value}</p>
      </div>
      <Button variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={() => onCopy(value, label)}>
        <Copy className="size-4" />
      </Button>
    </div>
  );
}
