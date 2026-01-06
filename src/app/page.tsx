'use client';

import { useState } from 'react';
import { ModeToggle } from '@/components';
import CameraDemo from './demos/CameraDemo';
import LocationDemo from './demos/LocationDemo';
import UPIDemo from './demos/UPIDemo';
import PushDemo from './demos/PushDemo';
import DocumentDemo from './demos/DocumentDemo';
import PaymentDemo from './demos/PaymentDemo';

const capabilities = [
  { id: 'camera', icon: '📷', title: 'Camera', desc: 'Photo capture & permissions' },
  { id: 'location', icon: '📍', title: 'Location', desc: 'GPS & geolocation' },
  { id: 'upi', icon: '💳', title: 'UPI Intent', desc: 'Payment deep links' },
  { id: 'push', icon: '🔔', title: 'Push', desc: 'Notifications' },
  { id: 'document', icon: '📄', title: 'Documents', desc: 'File picker' },
  { id: 'payment', icon: '💰', title: 'Payments', desc: 'Payment APIs' },
];

type Mode = 'browser' | 'webview';

export default function Home() {
  const [activeCapability, setActiveCapability] = useState('camera');
  const [mode, setMode] = useState<Mode>('browser');

  const renderDemo = () => {
    switch (activeCapability) {
      case 'camera': return <CameraDemo mode={mode} />;
      case 'location': return <LocationDemo mode={mode} />;
      case 'upi': return <UPIDemo mode={mode} />;
      case 'push': return <PushDemo mode={mode} />;
      case 'document': return <DocumentDemo mode={mode} />;
      case 'payment': return <PaymentDemo mode={mode} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Native Capabilities</h1>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      {/* Capability Tabs */}
      <nav className="border-b border-border overflow-x-auto">
        <div className="max-w-4xl mx-auto flex gap-1 p-2">
          {capabilities.map((cap) => (
            <button
              key={cap.id}
              onClick={() => setActiveCapability(cap.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap
                ${activeCapability === cap.id
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:bg-bg-card hover:text-text'
                }
              `}
            >
              <span className="text-lg">{cap.icon}</span>
              <div className="text-left">
                <div className="text-sm font-medium">{cap.title}</div>
              </div>
            </button>
          ))}
        </div>
      </nav>

      {/* Demo Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {renderDemo()}
        </div>
      </main>
    </div>
  );
}
