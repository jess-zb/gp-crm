import { redirect } from "next/navigation";

export default async function MidDocumentsRedirect({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  const id = resolved.id?.trim() ?? "";
  redirect(`/esign-documents/${id}`);
}
