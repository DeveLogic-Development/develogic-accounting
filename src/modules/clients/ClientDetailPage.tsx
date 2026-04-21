import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { formatCurrency, formatDate, formatMinorCurrency } from '@/utils/format';
import { InvoiceStatusBadge, QuoteStatusBadge } from '@/design-system/patterns/StatusBadge';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { Tabs } from '@/design-system/primitives/Tabs';
import { Textarea } from '@/design-system/primitives/Textarea';
import { InlineNotice } from '@/design-system/patterns/InlineNotice';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { useEmails } from '@/modules/emails/hooks/useEmails';
import {
  buildCustomerStatement,
  buildCustomerTransactions,
  filterCustomerMails,
  getCustomerReceivables,
} from './domain/customerWorkspace';

type CustomerWorkspaceTab =
  | 'overview'
  | 'comments'
  | 'transactions'
  | 'mails'
  | 'statement';

type TransactionFilter = 'all' | 'invoice' | 'payment' | 'quote';

const WORKSPACE_TABS: Array<{ key: CustomerWorkspaceTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'comments', label: 'Comments' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'mails', label: 'Mails' },
  { key: 'statement', label: 'Statement' },
];

export function ClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const {
    getClientById,
    getCustomerComments,
    loadCustomerComments,
    addCustomerComment,
    deleteClient,
  } = useMasterData();
  const { state, invoiceSummaries } = useAccounting();
  const emails = useEmails();
  const client = getClientById(clientId);

  const [activeTab, setActiveTab] = useState<CustomerWorkspaceTab>('overview');
  const [commentBody, setCommentBody] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentNotice, setCommentNotice] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<TransactionFilter>('all');
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!client?.id) return;
    void loadCustomerComments(client.id);
  }, [client?.id, loadCustomerComments]);

  if (!client) {
    return (
      <EmptyState
        title="Customer not found"
        description="This customer record may have been removed."
        action={
          <Link to="/clients">
            <Button variant="primary">Back to Customers</Button>
          </Link>
        }
      />
    );
  }

  const receivablesMinor = getCustomerReceivables(client.id, invoiceSummaries);
  const billingAddress = client.billingAddress ?? {};
  const shippingAddress = client.shippingAddress ?? {};
  const contactPersons = client.contactPersons ?? [];
  const customerInvoices = state.invoices
    .filter((invoice) => invoice.clientId === client.id)
    .slice()
    .sort((a, b) => (b.issueDate ?? '').localeCompare(a.issueDate ?? ''));
  const customerQuotes = state.quotes
    .filter((quote) => quote.clientId === client.id)
    .slice()
    .sort((a, b) => (b.issueDate ?? '').localeCompare(a.issueDate ?? ''));
  const customerPayments = state.payments
    .filter((payment) => {
      const invoice = state.invoices.find((entry) => entry.id === payment.invoiceId);
      return invoice?.clientId === client.id;
    })
    .slice()
    .sort((a, b) => (b.paymentDate ?? '').localeCompare(a.paymentDate ?? ''));

  const lastActivityAt =
    [
      ...customerInvoices.map((invoice) => invoice.updatedAt),
      ...customerQuotes.map((quote) => quote.updatedAt),
      ...customerPayments.map((payment) => payment.createdAt),
      client.updatedAt,
      client.createdAt,
    ]
      .filter(Boolean)
      .sort()
      .at(-1) ?? client.updatedAt;

  const comments = getCustomerComments(client.id);
  const customerTransactions = buildCustomerTransactions(client.id, state, invoiceSummaries);
  const filteredTransactions =
    txFilter === 'all'
      ? customerTransactions
      : customerTransactions.filter((transaction) => transaction.kind === txFilter);
  const customerMails = filterCustomerMails(client.id, emails.state.logs);

  const statement = useMemo(
    () =>
      buildCustomerStatement({
        client,
        accounting: state,
        invoiceSummaries,
        fromDate: statementFromDate || undefined,
        toDate: statementToDate || undefined,
      }),
    [client, invoiceSummaries, state, statementFromDate, statementToDate],
  );

  const submitComment = async () => {
    setCommentNotice(null);
    if (!commentBody.trim()) {
      setCommentNotice('Comment body is required.');
      return;
    }
    setCommentSaving(true);
    const result = await addCustomerComment(client.id, commentBody);
    setCommentSaving(false);
    if (!result.ok) {
      setCommentNotice(result.error ?? 'Unable to add comment.');
      return;
    }
    setCommentBody('');
    setCommentNotice('Comment added.');
  };

  const handleDeleteCustomer = async () => {
    const confirmed = window.confirm(
      `Delete customer "${client.displayName}"? This will hide it from active records.`,
    );
    if (!confirmed) return;

    setDeleteNotice(null);
    setDeleting(true);
    const result = await deleteClient(client.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteNotice(result.error ?? 'Unable to delete customer.');
      return;
    }
    navigate('/clients');
  };

  return (
    <>
      <PageHeader
        title={client.displayName}
        subtitle={`${client.companyName ?? 'Customer'} · ${client.email ?? 'No email'}`}
        actions={
          <>
            <Link to={`/clients/${client.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            <Link to={`/quotes/new?clientId=${client.id}`}>
              <Button variant="primary">New Transaction</Button>
            </Link>
            <Button variant="ghost" onClick={() => void handleDeleteCustomer()} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      />
      {deleteNotice ? <InlineNotice tone="error">{deleteNotice}</InlineNotice> : null}

      <div style={{ marginBottom: 12 }}>
        <Tabs tabs={WORKSPACE_TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as CustomerWorkspaceTab)} />
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="dl-grid cols-4">
            <Card title="Outstanding Receivables">
              <p className="dl-stat-value">{formatMinorCurrency(receivablesMinor)}</p>
            </Card>
            <Card title="Opening Balance">
              <p className="dl-stat-value">{formatCurrency(client.openingBalance ?? 0)}</p>
            </Card>
            <Card title="Unused Credits">
              <p className="dl-stat-value">{formatCurrency(client.unusedCredits ?? 0)}</p>
            </Card>
            <Card title="Customer Status">
              <p className="dl-stat-value" style={{ fontSize: 20 }}>
                {client.isActive ? 'Active' : 'Inactive'}
              </p>
              <p className="dl-stat-meta">Last activity: {formatDate(lastActivityAt)}</p>
            </Card>
          </div>

          <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Customer Profile">
              <div className="dl-meta-grid">
                <div><strong>Type:</strong> {client.customerType === 'business' ? 'Business' : 'Individual'}</div>
                <div><strong>Primary Contact:</strong> {client.contactName ?? 'N/A'}</div>
                <div><strong>Email:</strong> {client.email ?? 'N/A'}</div>
                <div>
                  <strong>Work Phone:</strong>{' '}
                  {[client.workPhoneCountryCode, client.workPhoneNumber].filter(Boolean).join(' ') || 'N/A'}
                </div>
                <div><strong>Payment Terms:</strong> {client.paymentTerms ?? 'N/A'}</div>
                <div><strong>Portal:</strong> {client.portalEnabled ? 'Enabled' : 'Disabled'}</div>
                <div><strong>Currency:</strong> {client.currencyCode ?? 'ZAR'}</div>
              </div>
            </Card>

            <Card title="Address Summary">
              <div className="dl-meta-grid">
                <div>
                  <strong>Billing:</strong>{' '}
                  {[
                    billingAddress.line1,
                    billingAddress.line2,
                    billingAddress.city,
                    billingAddress.stateRegion,
                    billingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No billing address'}
                </div>
                <div>
                  <strong>Shipping:</strong>{' '}
                  {[
                    shippingAddress.line1,
                    shippingAddress.line2,
                    shippingAddress.city,
                    shippingAddress.stateRegion,
                    shippingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No shipping address'}
                </div>
                <div><strong>Remarks:</strong> {client.remarks || 'No internal remarks added.'}</div>
              </div>
            </Card>
          </div>

          <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Contact Persons">
              {contactPersons.length === 0 ? (
                <p className="dl-muted">No contact persons added.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {contactPersons.map((contact) => (
                    <div key={contact.id} className="dl-card-list-item">
                      <strong>
                        {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed Contact'}
                      </strong>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {contact.email ?? 'No email'} · {contact.workPhoneNumber ?? contact.mobilePhoneNumber ?? 'No phone'}
                        {contact.isPrimary ? ' · Primary' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Activity Timeline">
              <div className="dl-timeline">
                <article className="dl-timeline-item">
                  <h3 className="dl-timeline-title">Customer Created</h3>
                  <p className="dl-timeline-meta">{formatDate(client.createdAt)}</p>
                </article>
                {customerInvoices.slice(0, 2).map((invoice) => (
                  <article className="dl-timeline-item" key={invoice.id}>
                    <h3 className="dl-timeline-title">Invoice {invoice.invoiceNumber}</h3>
                    <p className="dl-timeline-meta">
                      {invoice.status} · {formatDate(invoice.issueDate)}
                    </p>
                  </article>
                ))}
                {customerQuotes.slice(0, 2).map((quote) => (
                  <article className="dl-timeline-item" key={quote.id}>
                    <h3 className="dl-timeline-title">Quote {quote.quoteNumber}</h3>
                    <p className="dl-timeline-meta">
                      {quote.status} · {formatDate(quote.issueDate)}
                    </p>
                  </article>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {activeTab === 'comments' ? (
        <Card title="Customer Comments" subtitle="Internal chronological notes for this customer">
          {commentNotice ? <InlineNotice tone={commentNotice === 'Comment added.' ? 'success' : 'error'}>{commentNotice}</InlineNotice> : null}
          <Textarea
            label="Add Comment"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Write an internal customer note..."
          />
          <div style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={submitComment} disabled={commentSaving}>
              {commentSaving ? 'Adding...' : 'Add Comment'}
            </Button>
          </div>

          <div className="dl-divider" />

          {comments.length === 0 ? (
            <p className="dl-muted">No comments yet.</p>
          ) : (
            <div className="dl-timeline">
              {comments.map((comment) => (
                <article className="dl-timeline-item" key={comment.id}>
                  <h3 className="dl-timeline-title">Internal Comment</h3>
                  <p style={{ margin: '4px 0 0' }}>{comment.body}</p>
                  <p className="dl-timeline-meta">
                    {formatDate(comment.createdAt)} · {comment.createdBy ? `By ${comment.createdBy}` : 'By team member'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'transactions' ? (
        <Card title="Customer Transactions" subtitle="Quotes, invoices, and payments linked to this customer">
          <div className="dl-filter-bar">
            <Select
              value={txFilter}
              onChange={(event) => setTxFilter(event.target.value as TransactionFilter)}
              options={[
                { label: 'All Transactions', value: 'all' },
                { label: 'Invoices', value: 'invoice' },
                { label: 'Payments', value: 'payment' },
                { label: 'Quotes', value: 'quote' },
              ]}
              aria-label="Transaction type filter"
              style={{ width: 220 }}
            />
          </div>

          {filteredTransactions.length === 0 ? (
            <p className="dl-muted">No transactions found for this customer and filter.</p>
          ) : (
            <div className="dl-table-wrap">
              <table className="dl-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{row.kind}</td>
                      <td>{row.reference}</td>
                      <td>{row.status ?? '—'}</td>
                      <td>{formatMinorCurrency(row.amountMinor)}</td>
                      <td>{row.balanceMinor != null ? formatMinorCurrency(row.balanceMinor) : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="dl-btn ghost sm"
                          onClick={() => navigate(row.route)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'mails' ? (
        <Card title="Customer Mails" subtitle="Document-related mail sends for this customer">
          {customerMails.length === 0 ? (
            <p className="dl-muted">No emails sent yet.</p>
          ) : (
            <div className="dl-table-wrap">
              <table className="dl-table">
                <thead>
                  <tr>
                    <th>Attempted</th>
                    <th>Document</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Subject</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customerMails.map((mail) => (
                    <tr key={mail.id}>
                      <td>{formatDate(mail.attemptedAt)}</td>
                      <td>
                        {mail.document.documentNumber}
                        <div className="dl-muted" style={{ fontSize: 12 }}>
                          {mail.document.documentType}
                        </div>
                      </td>
                      <td>{mail.recipient.to}</td>
                      <td>
                        <BadgeForMailStatus status={mail.status} />
                      </td>
                      <td>{mail.subject}</td>
                      <td>
                        <Link to="/emails/history">View Log</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'statement' ? (
        <Card title="Customer Statement" subtitle="Statement of accounts for selected period">
          <div className="dl-filter-bar">
            <Input
              label="From"
              type="date"
              value={statementFromDate}
              onChange={(event) => setStatementFromDate(event.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={statementToDate}
              onChange={(event) => setStatementToDate(event.target.value)}
            />
            <Button variant="secondary" onClick={() => { setStatementFromDate(''); setStatementToDate(''); }}>
              Reset Range
            </Button>
          </div>

          <div className="dl-grid cols-4" style={{ marginBottom: 14 }}>
            <Card title="Opening Balance">
              <p className="dl-stat-value" style={{ fontSize: 20 }}>
                {formatMinorCurrency(statement.summary.openingBalanceMinor)}
              </p>
            </Card>
            <Card title="Invoiced Amount">
              <p className="dl-stat-value" style={{ fontSize: 20 }}>
                {formatMinorCurrency(statement.summary.invoicedMinor)}
              </p>
            </Card>
            <Card title="Payments Received">
              <p className="dl-stat-value" style={{ fontSize: 20 }}>
                {formatMinorCurrency(statement.summary.paymentsMinor)}
              </p>
            </Card>
            <Card title="Balance Due">
              <p className="dl-stat-value" style={{ fontSize: 20 }}>
                {formatMinorCurrency(statement.summary.balanceDueMinor)}
              </p>
            </Card>
          </div>

          <div className="dl-inline-actions" style={{ marginBottom: 10 }}>
            <Button variant="secondary" size="sm" disabled title="Statement print flow will be enabled next.">
              Print
            </Button>
            <Button variant="secondary" size="sm" disabled title="Statement download flow will be enabled next.">
              Download
            </Button>
            <Button variant="primary" size="sm" disabled title="Statement email flow will be enabled next.">
              Send Statement
            </Button>
          </div>
          <InlineNotice tone="info">
            Statement print/download/send actions are reserved for the statement delivery integration pass.
          </InlineNotice>

          <div className="dl-table-wrap">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Payments</th>
                  <th>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.reference}</td>
                    <td style={{ textTransform: 'capitalize' }}>{row.type.replace('_', ' ')}</td>
                    <td>{row.debitMinor ? formatMinorCurrency(row.debitMinor) : '—'}</td>
                    <td>{row.creditMinor ? formatMinorCurrency(row.creditMinor) : '—'}</td>
                    <td>{formatMinorCurrency(row.runningBalanceMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Recent Quotes">
          {customerQuotes.length === 0 ? (
            <p className="dl-muted">No quotes yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {customerQuotes.slice(0, 3).map((quote) => (
                <div key={quote.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <strong>{quote.quoteNumber}</strong>
                    <div className="dl-muted" style={{ fontSize: 12 }}>
                      Expires {formatDate(quote.expiryDate)}
                    </div>
                  </div>
                  <QuoteStatusBadge status={quote.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Invoices">
          {customerInvoices.length === 0 ? (
            <p className="dl-muted">No invoices yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {customerInvoices.slice(0, 3).map((invoice) => (
                <div key={invoice.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <strong>{invoice.invoiceNumber}</strong>
                    <div className="dl-muted" style={{ fontSize: 12 }}>
                      Due {formatDate(invoice.dueDate)}
                    </div>
                  </div>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function BadgeForMailStatus({ status }: { status: string }) {
  if (status === 'sent') return <span className="dl-badge success">Sent</span>;
  if (status === 'failed') return <span className="dl-badge danger">Failed</span>;
  if (status === 'sending') return <span className="dl-badge info">Sending</span>;
  if (status === 'queued') return <span className="dl-badge warning">Queued</span>;
  return <span className="dl-badge neutral">{status}</span>;
}
