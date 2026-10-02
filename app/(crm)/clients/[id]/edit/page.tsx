import { redirect } from "next/navigation";

/** Client profile editing lives on the main client page (Account tab). */
export default async function ClientEditRedirect({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await Promise.resolve(params);
  if (!id) redirect("/clients");
  redirect(`/clients/${id}`);
}
