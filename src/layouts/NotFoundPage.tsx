import { Link } from 'react-router-dom';
import { Button } from '@/design-system/primitives/Button';
import { EmptyState } from '@/design-system/patterns/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you requested does not exist in this workspace yet."
      action={
        <Link to="/dashboard">
          <Button variant="primary">Back to Dashboard</Button>
        </Link>
      }
    />
  );
}
