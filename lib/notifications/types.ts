export interface CRMNotification {
  id: string;
  type:
    | "appointment"
    | "collection_letter"
    | "stage_change"
    | "fedex_update"
    | "team_message"
    | "announcement"
    | "attorney_portal_assignment"
    /** Rows from DB with an unexpected type value */
    | "other";
  title: string;
  body: string;
  client_id?: string;
  client_name?: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}
