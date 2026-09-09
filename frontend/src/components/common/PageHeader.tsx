import { ReactNode } from "react";

interface Props {
  title: string;
  right?: ReactNode;
  children?: ReactNode;
}

/** Standard page header: title on the left, actions (export etc.) on the right. */
export function PageHeader({ title, right, children }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title">
          {title}
        </h1>
        {children}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
