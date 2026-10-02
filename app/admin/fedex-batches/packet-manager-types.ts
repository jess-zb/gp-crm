export type ShipmentClientEmbed = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_mobile: string | null;
  stage: string | null;
  created_at: string | null;
  fedex_queued_at: string | null;
};

export type PacketShipmentRow = {
  id: string;
  client_id: string;
  tracking_number: string | null;
  recipient_name: string;
  recipient_type: string;
  carrier: string;
  batch_id: string | null;
  batch_date: string | null;
  status: string | null;
  advisor: string | null;
  merchant: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  carrier_status: string | null;
  client: ShipmentClientEmbed | ShipmentClientEmbed[] | null;
};

export type PacketNeededRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_mobile: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  fedex_queued_at: string | null;
  created_at?: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  fedex_merchant?: string | null;
  card_merchant?: string | null;
  stage?: string | null;
  recipient_type: "primary" | "secondary";
  assigned_user?:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null;
};
