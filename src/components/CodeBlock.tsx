'use client';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code }: CodeBlockProps) {
  return (
    <pre className="bg-[#0d1117] rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
      <code className="text-[#c9d1d9] font-mono">{code}</code>
    </pre>
  );
}
