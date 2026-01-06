'use client';

interface ResultProps {
  data: unknown;
  status: 'idle' | 'pending' | 'success' | 'error';
}

export function Result({ data, status }: ResultProps) {
  if (status === 'idle') return null;

  const colors = {
    pending: 'border-yellow-500/30 bg-yellow-500/10',
    success: 'border-green-500/30 bg-green-500/10',
    error: 'border-red-500/30 bg-red-500/10',
  };

  return (
    <div className={`rounded-lg border p-3 mt-4 ${colors[status]}`}>
      {status === 'pending' ? (
        <div className="flex items-center justify-center py-2">
          <span className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
