import { ValidationIssue } from '../domain/types';

interface FormValidationSummaryProps {
  issues: ValidationIssue[];
}

export function FormValidationSummary({ issues }: FormValidationSummaryProps) {
  if (issues.length === 0) return null;

  return (
    <div className="dl-validation-box" role="alert" aria-live="polite">
      <strong>Please fix the following:</strong>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}
