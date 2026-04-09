import { ReactNode } from 'react';
import { Table } from '@/design-system/primitives/Table';

interface ResponsiveListProps {
  headers: string[];
  desktopRows: ReactNode;
  mobileCards: ReactNode;
}

export function ResponsiveList({ headers, desktopRows, mobileCards }: ResponsiveListProps) {
  return (
    <>
      <Table headers={headers}>{desktopRows}</Table>
      <div className="dl-mobile-list">{mobileCards}</div>
    </>
  );
}
