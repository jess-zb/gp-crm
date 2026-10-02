/**
 * Lightweight client-profile updates after an upload, so the stage header and
 * checklist can move without router.refresh() of the whole page.
 */
export const CLIENT_PROFILE_PATCH_EVENT = "zb-crm:client-profile-patch";

export type ClientProfilePatch = {
  clientId: string;
  stage?: string | null;
  poaSignedAt?: string | null;
  hasPoaDocument?: boolean;
};

export function emitClientProfilePatch(patch: ClientProfilePatch): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLIENT_PROFILE_PATCH_EVENT, { detail: patch }));
}

export function subscribeClientProfilePatch(
  clientId: string,
  onPatch: (patch: ClientProfilePatch) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ClientProfilePatch>).detail;
    if (!detail || detail.clientId !== clientId) return;
    onPatch(detail);
  };
  window.addEventListener(CLIENT_PROFILE_PATCH_EVENT, handler);
  return () => window.removeEventListener(CLIENT_PROFILE_PATCH_EVENT, handler);
}
