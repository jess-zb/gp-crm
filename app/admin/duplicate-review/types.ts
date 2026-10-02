export type DuplicateClientPair = {
  phone_mobile: string;
  phone_digits: string;
  primary_id: string;
  primary_name: string | null;
  primary_stage: string | null;
  secondary_id: string;
  secondary_name: string | null;
  secondary_stage: string | null;
  record_count: number;
  is_likely_household: boolean;
};
