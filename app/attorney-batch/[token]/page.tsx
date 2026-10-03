import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { loadPublicAttorneyBatch } from "@/lib/attorney-queue/public-batch";
import { PublicAttorneyBatchClient } from "./PublicAttorneyBatchClient";

export const dynamic = "force-dynamic";

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Golden Pathway"
      width={180}
      height={54}
      className={`object-contain ${className}`.trim()}
      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.45))" }}
      priority
    />
  );
}

export default async function AttorneyBatchPublicPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token?.trim() ?? "";
  const supabase = createServiceClient();
  const loaded = await loadPublicAttorneyBatch(supabase, token);

  if (!loaded.ok) {
    const title =
      loaded.reason === "expired"
        ? "Link expired"
        : loaded.reason === "revoked"
          ? "Link revoked"
          : "Invalid link";
    const body =
      loaded.reason === "expired"
        ? "This attorney download link has expired. Ask Golden Pathway staff for a new batch link."
        : loaded.reason === "revoked"
          ? "This attorney download link was revoked. Ask Golden Pathway staff for a new batch link."
          : loaded.reason === "error"
            ? "This download link could not be loaded. Please try again or ask Golden Pathway staff for help."
            : "This download link is not valid.";

    return (
      <main className="min-h-screen bg-[#161616] px-4 py-16 text-[#E8EAEE]">
        <div className="mx-auto max-w-lg text-center">
          <BrandMark className="mx-auto" />
          <h1 className="mt-6 text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-sm text-slate-300">{body}</p>
        </div>
      </main>
    );
  }

  const { batch } = loaded;
  const totalFiles = batch.clients.reduce(
    (n, c) => n + c.documents.length,
    0
  );

  return (
    <main className="min-h-screen bg-[#161616] px-4 py-10 text-[#E8EAEE] sm:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <BrandMark />
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">
            Attorney file batch
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {batch.clients.length} client
            {batch.clients.length === 1 ? "" : "s"} · {totalFiles} file
            {totalFiles === 1 ? "" : "s"}
            {batch.note ? ` · ${batch.note}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Link expires{" "}
            {new Date(batch.expires_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            . No login required — keep this URL private.
          </p>
        </header>

        <PublicAttorneyBatchClient token={token} clients={batch.clients} />
      </div>
    </main>
  );
}
