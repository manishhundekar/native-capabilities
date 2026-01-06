'use client';

interface StatusBadgeProps {
  status: 'idle' | 'pending' | 'success' | 'error';
  label: string;
  value: string;
}

export function StatusBadge({ status, label, value }: StatusBadgeProps) {
  const colors = {
    idle: 'border-border',
    pending: 'border-yellow-500/50 bg-yellow-500/10',
    success: 'border-green-500/50 bg-green-500/10',
    error: 'border-red-500/50 bg-red-500/10',
  };

  const textColors = {
    idle: 'text-text-muted',
    pending: 'text-yellow-400',
    success: 'text-green-400',
    error: 'text-red-400',
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[status]} transition-all`}>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-sm font-medium ${textColors[status]}`}>{value}</div>
    </div>
  );
}
