import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { TransactionForm } from "@/components/ledger/TransactionForm";
import { useCategories, useCreateTransaction } from "@/hooks/useLedger";

export const Route = createFileRoute("/_authenticated/add-transaction")({
  head: () => ({
    meta: [
      { title: "Add transaction — Kinship Capital" },
      { name: "description", content: "Record a cash, M-PESA or bank transaction in the right ledger." },
      { property: "og:title", content: "Add transaction — Kinship Capital" },
      { property: "og:description", content: "Record a transaction in the right household ledger." },
    ],
  }),
  component: AddTransactionPage,
});

function AddTransactionPage() {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const create = useCreateTransaction();

  return (
    <AppShell title="Add transaction" subtitle="Record it in the right ledger">
      <div className="surface p-4 sm:p-6">
        <TransactionForm
          categories={categories}
          submitLabel="Save transaction"
          busy={create.isPending}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                toast.success("Transaction recorded");
                void navigate({ to: "/transactions" });
              },
              onError: (e) => toast.error((e as Error).message),
            })
          }
          onCancel={() => void navigate({ to: "/dashboard" })}
        />
      </div>
    </AppShell>
  );
}
