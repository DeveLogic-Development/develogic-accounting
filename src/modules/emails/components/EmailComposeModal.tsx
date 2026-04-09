import { useEffect, useId } from 'react';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { Button } from '@/design-system/primitives/Button';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { EmailComposeDraft } from '../domain/types';

interface AttachmentOption {
  value: string;
  label: string;
}

interface EmailComposeModalProps {
  open: boolean;
  title: string;
  draft: EmailComposeDraft | null;
  attachmentOptions: AttachmentOption[];
  sending: boolean;
  message?: string | null;
  messageTone?: InlineNoticeTone;
  sendDisabledReason?: string;
  onClose: () => void;
  onChange: (draft: EmailComposeDraft) => void;
  onSend: () => void;
}

export function EmailComposeModal({
  open,
  title,
  draft,
  attachmentOptions,
  sending,
  message,
  messageTone = 'error',
  sendDisabledReason,
  onClose,
  onChange,
  onSend,
}: EmailComposeModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!open || event.key !== 'Escape' || sending) return;
      onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, open, sending]);

  if (!open || !draft) return null;

  const hasArchivedAttachment = Boolean(draft.attachmentRecordId);

  return (
    <div
      className="dl-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) {
          onClose();
        }
      }}
    >
      <div className="dl-modal" role="document">
        <header className="dl-modal-header">
          <div>
            <h3 id={titleId} style={{ margin: 0 }}>{title}</h3>
            <p className="dl-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {draft.document.documentNumber} · {draft.document.clientName}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Close
          </Button>
        </header>

        <div className="dl-modal-body">
          <div className="dl-form-grid">
            <Input
              label="To"
              value={draft.recipient.to}
              onChange={(event) =>
                onChange({
                  ...draft,
                  recipient: {
                    ...draft.recipient,
                    to: event.target.value,
                  },
                })
              }
            />
            <Input
              label="CC"
              value={draft.recipient.cc ?? ''}
              onChange={(event) =>
                onChange({
                  ...draft,
                  recipient: {
                    ...draft.recipient,
                    cc: event.target.value,
                  },
                })
              }
              placeholder="Optional"
            />
          </div>

          <Input
            label="Subject"
            value={draft.subject}
            onChange={(event) =>
              onChange({
                ...draft,
                subject: event.target.value,
              })
            }
          />

          <Textarea
            label="Message"
            value={draft.body}
            onChange={(event) =>
              onChange({
                ...draft,
                body: event.target.value,
              })
            }
            style={{ minHeight: 200 }}
          />

          <Select
            label="Attachment PDF"
            value={draft.attachmentRecordId ?? ''}
            onChange={(event) =>
              onChange({
                ...draft,
                attachmentRecordId: event.target.value || undefined,
              })
            }
            options={[
              { label: 'Auto-select latest archived PDF', value: '' },
              ...attachmentOptions,
            ]}
            helperText={
              hasArchivedAttachment
                ? 'Selected archived PDF will be attached.'
                : 'If no archived PDF exists, a historical archive will be generated on send.'
            }
          />

          {draft.resendOfLogId ? (
            <InlineNotice tone="info">
              This is a resend of log #{draft.resendOfLogId}.
            </InlineNotice>
          ) : null}

          {message ? <InlineNotice tone={messageTone}>{message}</InlineNotice> : null}
          {sendDisabledReason ? <InlineNotice tone="warning">{sendDisabledReason}</InlineNotice> : null}
        </div>

        <footer className="dl-modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSend} disabled={sending || Boolean(sendDisabledReason)}>
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
