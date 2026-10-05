export type DashboardClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_mobile?: string | null;
  stage_entered_at?: string | null;
  stage?: string | null;
  sub_status?: string | null;
  poa_signed_at?: string | null;
  poa_signed_date?: string | null;
  shape_contact_id?: string | null;
};

export type TodayAppointmentRow = {
  id: string;
  description: string | null;
  due_date: string | null;
  appointment_type: string | null;
  client: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;
};

export type TeamActivityRow = {
  action: string;
  created_at: string;
  performed_by_name: string | null;
  new_value: { stage?: string } | null;
  client: {
    id?: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export type AlertClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  stage?: string | null;
  stage_entered_at?: string | null;
};
