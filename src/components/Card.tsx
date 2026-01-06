'use client';

import { ReactNode } from 'react';

interface CardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, description, children, className = '' }: CardProps) {
  return (
    <div className={`bg-bg-card border border-border rounded-xl overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
