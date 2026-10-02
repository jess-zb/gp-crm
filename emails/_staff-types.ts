export type AttorneyPortalAssignmentEmailProps = {
  attorney: { firstName: string; lastName: string };
  casesUrl: string;
  clients: { name: string; caseUrl: string }[];
};
