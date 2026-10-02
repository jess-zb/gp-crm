import { render } from "@react-email/render";
import {
  staffTemplateRegistry,
  STAFF_TEMPLATE_SUBJECTS,
  type StaffTemplateKey,
} from "@/emails/staff-index";

export async function renderStaffEmailTemplate(
  templateKey: StaffTemplateKey,
  variables: Record<string, unknown>
): Promise<{ subject: string; html: string }> {
  const Component = staffTemplateRegistry[templateKey];
  if (!Component) {
    throw new Error(`Unknown staff template: ${templateKey}`);
  }
  const html = await render(Component(variables as never), { pretty: false });
  const subject = STAFF_TEMPLATE_SUBJECTS[templateKey];
  if (templateKey === "attorney_portal_assignment") {
    const clients = (variables.clients as { name: string }[] | undefined) ?? [];
    if (clients.length === 1 && clients[0]?.name) {
      return { subject: `New Case Assigned — ${clients[0].name}`, html };
    }
    if (clients.length > 1) {
      return { subject: `${clients.length} New Cases Assigned`, html };
    }
  }
  return { subject, html };
}
