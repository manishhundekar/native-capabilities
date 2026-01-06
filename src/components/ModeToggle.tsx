'use client';

type Mode = 'browser' | 'webview';

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex gap-1 p-1 bg-bg-card rounded-lg border border-border">
      <button
        onClick={() => onChange('browser')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === 'browser' 
            ? 'bg-accent text-white' 
            : 'text-text-muted hover:text-text'
        }`}
      >
        🌐 Browser
      </button>
      <button
        onClick={() => onChange('webview')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === 'webview' 
            ? 'bg-accent text-white' 
            : 'text-text-muted hover:text-text'
        }`}
      >
        📱 WebView
      </button>
    </div>
  );
}
