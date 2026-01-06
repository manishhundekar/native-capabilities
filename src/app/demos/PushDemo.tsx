'use client';

import '@/lib/types';
import { callNativeBridge } from '@/lib/types';

import { useState } from 'react';
import { Stepper, Card, Button, StatusBadge, CodeBlock, Result } from '@/components';

const steps = [
  { id: 'compare', title: 'Compare', description: 'Pros & cons of each mode' },
  { id: 'check', title: 'Check Support', description: 'Verify notification API' },
  { id: 'permission', title: 'Get Permission', description: 'Request notification access' },
  { id: 'register', title: 'Register', description: 'Get push token' },
  { id: 'code', title: 'Code', description: 'Implementation details' },
];

interface Props { mode: 'browser' | 'webview'; }


export default function PushDemo({ mode }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [apiSupported, setApiSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const markStepComplete = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const goToNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setStatus('idle');
      setResult(null);
    }
  };

  const checkSupport = async () => {
    setStatus('pending');
    setResult(null);
    
    if (mode === 'browser') {
      try {
        const hasNotification = 'Notification' in window;
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
        
        const supported = hasNotification && hasServiceWorker && hasPushManager && isSecure;
        setApiSupported(supported);
        setResult({ 
          Notification: hasNotification,
          ServiceWorker: hasServiceWorker,
          PushManager: hasPushManager,
          SecureContext: isSecure,
          currentPermission: hasNotification ? Notification.permission : 'N/A',
        });
        setStatus(supported ? 'success' : 'error');
        if (supported) markStepComplete(1);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Check failed' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.checkPushSupport) {
          throw new Error('NativeBridge.checkPushSupport not available. Are you running in a WebView with native bridge?');
        }
        const res = callNativeBridge<{ supported: boolean; provider: string }>(() => window.NativeBridge?.checkPushSupport?.());
        if (res) { setApiSupported(res.supported);
        setResult(res);
        setStatus(res.supported ? 'success' : 'error');
        if (res.supported) markStepComplete(1); } else { throw new Error("Failed"); }
      } catch (err) {
        setApiSupported(false);
        setResult({ error: err instanceof Error ? err.message : 'Native bridge call failed' });
        setStatus('error');
      }
    }
  };

  const requestPermission = async () => {
    setStatus('pending');
    setResult(null);
    
    if (mode === 'browser') {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        setResult({ 
          permission: perm,
          message: perm === 'granted' 
            ? 'Notification permission granted' 
            : perm === 'denied'
              ? 'Permission denied. Reset in browser settings.'
              : 'Permission dismissed'
        });
        setStatus(perm === 'granted' ? 'success' : 'error');
        if (perm === 'granted') markStepComplete(2);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Permission request failed' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.requestPushPermission) {
          throw new Error('NativeBridge.requestPushPermission not available');
        }
        const res = callNativeBridge<{ granted: boolean }>(
          () => window.NativeBridge?.requestPushPermission?.()
        );
        if (res) {
          setPermission(res.granted ? 'granted' : 'prompt');
          setResult({ ...res, note: 'Permission handled by native layer' });
          setStatus('success');
          markStepComplete(2);
        } else {
          throw new Error('Failed to parse response');
        }
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native bridge call failed' });
        setStatus('error');
      }
    }
  };

  const registerToken = async () => {
    setStatus('pending');
    setResult(null);
    
    if (mode === 'browser') {
      try {
        // Register service worker first
        const registration = await navigator.serviceWorker.register('/sw.js').catch(() => {
          throw new Error('Service Worker registration failed. Create /public/sw.js first.');
        });
        
        // Subscribe to push - need VAPID key in production
        // This will fail without proper VAPID setup
        try {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            // In production, use your VAPID public key
            applicationServerKey: undefined
          });
          
          const tokenStr = JSON.stringify(subscription.toJSON());
          setToken(tokenStr.substring(0, 50) + '...');
          setResult({ 
            endpoint: subscription.endpoint.substring(0, 60) + '...',
            keys: 'Present',
            note: 'Send this subscription to your server'
          });
          setStatus('success');
          markStepComplete(3);
        } catch {
          // VAPID key required
          setResult({
            error: 'Push subscription requires VAPID key',
            note: 'In production, generate VAPID keys and configure your server',
            serviceWorker: 'Registered successfully'
          });
          setStatus('error');
        }
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Registration failed' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.registerForPush) {
          throw new Error('NativeBridge.registerForPush not available');
        }
        const res = callNativeBridge<{ token: string; provider: string }>(
          () => window.NativeBridge?.registerForPush?.()
        );
        if (res && res.token) {
          setToken(res.token);
          setResult(res);
          setStatus('success');
          markStepComplete(3);
        } else {
          setResult({ note: 'Token registration in progress...' });
        }
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native registration failed' });
        setStatus('error');
      }
    }
  };

  const browserCode = `// Check support
const hasNotification = 'Notification' in window;
const hasServiceWorker = 'serviceWorker' in navigator;
const hasPushManager = 'PushManager' in window;

// Request permission
const permission = await Notification.requestPermission();
// Returns: 'granted', 'denied', 'default'

// Register service worker
const registration = await navigator.serviceWorker.register('/sw.js');

// Generate VAPID keys (do this once, server-side)
// npx web-push generate-vapid-keys

// Subscribe to push
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
});

// Send subscription to your server
await fetch('/api/push/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(subscription)
});

// Service Worker (public/sw.js)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      data: data.url,
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data || '/'));
  }
});

// Server-side: Send push notification
// const webpush = require('web-push');
// webpush.setVapidDetails('mailto:you@example.com', publicKey, privateKey);
// await webpush.sendNotification(subscription, JSON.stringify({ title, body }));`;

  const webviewCode = `// JavaScript - Check support
const support = await window.NativeBridge.checkPushSupport();
// Returns: { supported: true, provider: 'FCM' }

// Request permission
const permission = await window.NativeBridge.requestPushPermission();
// Returns: { granted: true }

// Register and get token
const registration = await window.NativeBridge.registerForPush();
// Returns: { token: 'fcm_token_here...', provider: 'FCM' }

// Android Kotlin - Firebase Cloud Messaging
class PushBridge(private val context: Context) {
  
  @JavascriptInterface
  fun checkPushSupport(): String {
    return JSONObject().apply {
      put("supported", true)
      put("provider", "FCM")
    }.toString()
  }
  
  @JavascriptInterface
  fun registerForPush(callback: String) {
    FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
      if (task.isSuccessful) {
        val token = task.result
        webView.evaluateJavascript(
          "window.onPushToken({ token: '$token', provider: 'FCM' })", null
        )
      }
    }
  }
}

// Firebase Messaging Service
class MyFirebaseService : FirebaseMessagingService() {
  
  override fun onNewToken(token: String) {
    // Send to your server
    sendTokenToServer(token)
  }
  
  override fun onMessageReceived(message: RemoteMessage) {
    // Handle data payload
    val data = message.data
    
    // Show notification if app is in background
    message.notification?.let {
      showNotification(it.title, it.body)
    }
    
    // Forward to WebView if in foreground
    webView?.evaluateJavascript(
      "window.onPushMessage(\${data.toJson()})", null
    )
  }
}

// iOS Swift - APNs + Firebase
class PushBridge: NSObject {
  
  func registerForPush() {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
      if granted {
        DispatchQueue.main.async {
          UIApplication.shared.registerForRemoteNotifications()
        }
      }
    }
  }
}

// AppDelegate
func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
  // Convert to FCM token if using Firebase
  Messaging.messaging().apnsToken = token
  
  Messaging.messaging().token { token, error in
    if let token = token {
      webView.evaluateJavaScript("window.onPushToken({ token: '\\(token)', provider: 'FCM' })")
    }
  }
}`;

  const browserPros = [
    'No app installation required',
    'Works on desktop and mobile browsers',
    'Single codebase for web push',
    'Progressive Web App (PWA) compatible',
    'Users can receive notifications when browser closed',
  ];
  const browserCons = [
    'Requires HTTPS',
    'Service Worker setup required',
    'VAPID key configuration needed',
    'iOS Safari has limited support',
    'Lower delivery reliability than native',
    'Browser-specific behavior differences',
  ];
  const webviewPros = [
    'Higher delivery reliability',
    'Rich notification features',
    'Works when app is killed',
    'Better battery optimization',
    'Consistent behavior across devices',
    'Access to notification channels (Android)',
    'Silent/background notifications',
  ];
  const webviewCons = [
    'Requires native app',
    'FCM/APNs setup required',
    'Platform-specific code',
    'App store distribution needed',
    'More complex server setup',
  ];

  return (
    <div className="p-4">
      <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} completedSteps={completedSteps} />

      <div className="mt-4 space-y-4">
        {currentStep === 0 && (
          <Card title="Browser vs WebView: Push Notifications" description="Compare push notification approaches">
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${mode === 'browser' ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <h4 className="font-semibold mb-3">🌐 Browser Mode (Web Push)</h4>
                <div className="mb-3">
                  <div className="text-xs text-green-400 font-medium mb-1">PROS</div>
                  <ul className="text-sm space-y-1">
                    {browserPros.map((p, i) => <li key={i} className="text-text-muted">✓ {p}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs text-red-400 font-medium mb-1">CONS</div>
                  <ul className="text-sm space-y-1">
                    {browserCons.map((c, i) => <li key={i} className="text-text-muted">✗ {c}</li>)}
                  </ul>
                </div>
              </div>
              <div className={`p-4 rounded-lg border ${mode === 'webview' ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <h4 className="font-semibold mb-3">📱 WebView Mode (FCM/APNs)</h4>
                <div className="mb-3">
                  <div className="text-xs text-green-400 font-medium mb-1">PROS</div>
                  <ul className="text-sm space-y-1">
                    {webviewPros.map((p, i) => <li key={i} className="text-text-muted">✓ {p}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs text-red-400 font-medium mb-1">CONS</div>
                  <ul className="text-sm space-y-1">
                    {webviewCons.map((c, i) => <li key={i} className="text-text-muted">✗ {c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-bg-elevated rounded-lg">
              <div className="text-sm font-medium mb-1">Recommendation</div>
              <p className="text-sm text-text-muted">
                Use <strong>Web Push</strong> for PWAs and reaching users without an app.
                Use <strong>FCM/APNs</strong> for critical notifications requiring high delivery rates.
              </p>
            </div>
            <Button onClick={goToNextStep} className="mt-4">Continue to Implementation →</Button>
          </Card>
        )}

        {currentStep === 1 && (
          <Card title="Step 1: Check Push Support" description={mode === 'browser' ? 'Web Push APIs' : 'Native push service'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="Push Available" value={apiSupported === null ? '—' : apiSupported ? '✓ Yes' : '✗ No'} status={apiSupported === null ? 'idle' : apiSupported ? 'success' : 'error'} />
              <StatusBadge label="Mode" value={mode === 'browser' ? '🌐 Web Push' : '📱 FCM/APNs'} status="idle" />
            </div>
            <Button onClick={checkSupport} loading={status === 'pending'}>Check Push Support</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(1) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 2 && (
          <Card title="Step 2: Request Permission" description="Get user consent for notifications">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="Permission" value={permission || '—'} status={permission === 'granted' ? 'success' : permission ? 'error' : 'idle'} />
              <StatusBadge label="Method" value={mode === 'browser' ? 'Notification.requestPermission()' : 'Native Dialog'} status="idle" />
            </div>
            <Button onClick={requestPermission} loading={status === 'pending'}>Request Notification Permission</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(2) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 3 && (
          <Card title="Step 3: Register & Get Token" description="Subscribe to push notifications">
            {token && (
              <div className="bg-bg-elevated rounded-lg p-4 mb-4">
                <div className="text-xs text-text-muted mb-1">Push Token</div>
                <code className="text-xs break-all">{token}</code>
              </div>
            )}
            <p className="text-sm text-text-muted mb-4">
              {mode === 'browser' 
                ? 'Registers Service Worker and subscribes to PushManager. Requires VAPID keys in production.' 
                : 'Gets FCM (Android) or APNs (iOS) token from native messaging service.'}
            </p>
            <Button onClick={registerToken} loading={status === 'pending'}>🔔 Register for Push</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(3) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 4 && (
          <Card title="Implementation Code" description={`${mode === 'browser' ? 'Web Push' : 'FCM/APNs'} implementation`}>
            <CodeBlock code={mode === 'browser' ? browserCode : webviewCode} />
            <Button onClick={() => { setCurrentStep(0); setCompletedSteps(new Set()); setResult(null); setStatus('idle'); }} variant="ghost" className="mt-3">← Start Over</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
