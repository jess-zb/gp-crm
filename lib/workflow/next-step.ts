import { hasSignedPoaOnRecord } from "@/lib/clients/poa-upload-advance";

/**
 * One sentence under the client's name. It tells the rep the next click.
 */
export function nextStepForClient(args: {
  stage: string;
  hasCcAuthorization: boolean;
  hasWelcomePacket: boolean;
}): string | null {
  const stage = args.stage.trim();
  switch (stage) {
    case "lead":
      return "Next: when a card charges, move this client to Account Manager and pick who they talk to. Uploading the Welcome Packet also moves them to Account Manager. Uploading the credit card form moves them to Client Services.";
    case "account_manager":
      if (!args.hasCcAuthorization) {
        return "Next: get the credit card form signed on the phone and upload it under Documents. That moves them to Client Services.";
      }
      if (!args.hasWelcomePacket) {
        return "Next: the credit card form is on file. Upload the Welcome Packet. That moves them to Awaiting Collections.";
      }
      return "Next: both files are on the page. This client should be in Awaiting Collections.";
    case "client_services":
      if (!args.hasWelcomePacket) {
        return "Next: get the Welcome Packet and upload it under Documents. That moves them to Awaiting Collections.";
      }
      return "Next: the Welcome Packet is on file. This client should be in Awaiting Collections.";
    case "awaiting_collection_letter":
      return "Next: when the collection letter comes in, upload it under Documents. That sends the case to the attorney.";
    case "case_sent_to_attorneys":
      return "This client made it. They went from New Lead all the way to the attorney. Clients, then Successful, lists everyone who did.";
    default:
      return null;
  }
}

export function clientHasWelcomePacket(args: {
  poaSignedAt?: string | null;
  hasPoaDocument?: boolean;
}): boolean {
  return hasSignedPoaOnRecord(args);
}
