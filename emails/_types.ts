export type EmailProps = {
  client: { firstName: string; lastName: string; caseLast4?: string };
  accountManager: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
  };
  portalUrl: string;
  unsubscribeUrl: string;
};

