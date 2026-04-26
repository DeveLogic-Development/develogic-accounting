import { interpolateTemplate } from './interpolation';
import { EmailTemplateDefinition, EmailTemplateKind, EmailTemplatePayload } from './types';

const TEMPLATE_DEFINITIONS: Record<EmailTemplateKind, EmailTemplateDefinition> = {
  quote_send: {
    kind: 'quote_send',
    subjectTemplate: '{{business_name}} Quote {{document_number}}',
    bodyTemplate: `Hi {{client_name}},

Please find attached quote {{document_number}} from {{business_name}}.

Issue Date: {{issue_date}}
Valid Until: {{expiry_date}}
Quoted Total: {{total_amount}}

If you have any questions, just reply to this email and we will assist.

Kind regards,
{{business_name}}`,
  },
  invoice_send: {
    kind: 'invoice_send',
    subjectTemplate: '{{business_name}} Invoice {{document_number}}',
    bodyTemplate: `Hi {{client_name}},

Please find attached invoice {{document_number}} from {{business_name}}.

Issue Date: {{issue_date}}
Due Date: {{due_date}}
Invoice Total: {{total_amount}}

Payment Instructions:
{{payment_reference_instruction}}
{{eft_instruction_notes}}

Upload Proof of Payment:
{{proof_submission_url}}

Kind regards,
{{business_name}}`,
  },
};

function toInterpolationValues(payload: EmailTemplatePayload): Record<string, string> {
  return {
    business_name: payload.businessName,
    client_name: payload.clientName,
    document_number: payload.documentNumber,
    issue_date: payload.issueDate,
    due_date: payload.dueDate ?? '',
    expiry_date: payload.expiryDate ?? '',
    total_amount: payload.totalFormatted,
    payment_reference_instruction: payload.paymentReferenceInstruction ?? '',
    eft_instruction_notes: payload.eftInstructionNotes ?? '',
    proof_submission_url: payload.proofSubmissionUrl ?? '',
  };
}

export function getEmailTemplateDefinition(kind: EmailTemplateKind): EmailTemplateDefinition {
  return TEMPLATE_DEFINITIONS[kind];
}

export function buildDefaultEmailSubject(kind: EmailTemplateKind, payload: EmailTemplatePayload): string {
  const template = getEmailTemplateDefinition(kind);
  return interpolateTemplate(template.subjectTemplate, toInterpolationValues(payload)).trim();
}

export function buildDefaultEmailBody(kind: EmailTemplateKind, payload: EmailTemplatePayload): string {
  const template = getEmailTemplateDefinition(kind);
  return interpolateTemplate(template.bodyTemplate, toInterpolationValues(payload)).trim();
}
