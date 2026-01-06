'use client';

import '@/lib/types';
import { callNativeBridge } from '@/lib/types';

import { useState } from 'react';
import { Stepper, Card, Button, StatusBadge, CodeBlock, Result } from '@/components';

const steps = [
  { id: 'compare', title: 'Compare', description: 'Pros & cons of each mode' },
  { id: 'check', title: 'Check Support', description: 'Detect UPI capability' },
  { id: 'handlers', title: 'Get Handlers', description: 'List installed apps' },
  { id: 'trigger', title: 'Trigger Intent', description: 'Open UPI app' },
  { id: 'code', title: 'Code', description: 'Implementation details' },
];

interface Props { mode: 'browser' | 'webview'; }

interface UPIApp {
  packageName: string;
  appName: string;
}


export default function UPIDemo({ mode }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [upiSupported, setUpiSupported] = useState<boolean | null>(null);
  const [handlers, setHandlers] = useState<UPIApp[] | null>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

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
      // Browser can only try to open UPI deep links, cannot detect apps
      const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
      setUpiSupported(isMobile);
      setResult({ 
        canOpenUPILink: isMobile,
        platform: navigator.platform,
        userAgent: navigator.userAgent.substring(0, 50) + '...',
        note: isMobile 
          ? 'Can attempt to open upi:// links, but cannot detect installed apps' 
          : 'UPI links only work on mobile devices with UPI apps'
      });
      setStatus(isMobile ? 'success' : 'error');
      if (isMobile) markStepComplete(1);
    } else {
      try {
        if (!window.NativeBridge?.checkUPISupport) {
          throw new Error('NativeBridge.checkUPISupport not available. Are you running in a WebView with native bridge?');
        }
        const res = callNativeBridge<{ supported: boolean; platform: string; appsCount?: number }>(
          () => window.NativeBridge?.checkUPISupport?.()
        );
        if (res) {
          setUpiSupported(res.supported);
          setResult(res);
          setStatus(res.supported ? 'success' : 'error');
          if (res.supported) markStepComplete(1);
        } else {
          throw new Error('Failed to parse response');
        }
      } catch (err) {
        setUpiSupported(false);
        setResult({ error: err instanceof Error ? err.message : 'Native bridge call failed' });
        setStatus('error');
      }
    }
  };

  const getHandlers = async () => {
    setStatus('pending');
    setResult(null);
    
    if (mode === 'browser') {
      setResult({ 
        error: 'Browser cannot query installed apps',
        note: 'Due to browser security, we cannot detect which UPI apps are installed. The UPI link will open the default handler or show a chooser on mobile.'
      });
      setStatus('error');
    } else {
      try {
        if (!window.NativeBridge?.getUPIApps) {
          throw new Error('NativeBridge.getUPIApps not available');
        }
        const res = callNativeBridge<{ apps: { packageName: string; appName: string }[] }>(
          () => window.NativeBridge?.getUPIApps?.()
        );
        if (res) {
          setHandlers(res.apps);
          setResult({ 
            appsFound: res.apps.length,
            apps: res.apps.map(a => a.appName)
          });
          setStatus(res.apps.length > 0 ? 'success' : 'error');
          if (res.apps.length > 0) markStepComplete(2);
        } else {
          throw new Error('Failed to parse response');
        }
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native bridge call failed' });
        setStatus('error');
      }
    }
  };

  const triggerIntent = async (packageName?: string) => {
    setSelectedApp(packageName || 'default');
    setStatus('pending');
    setResult(null);
    
    const paymentParams = {
      pa: 'testupihandler@ibl',  // Payee VPA
      pn: 'Manish',  // Payee name
      am: '1.00',  // Amount
      tn: 'Test payment',  // Transaction note
      cu: 'INR',  // Currency
    };
    
    if (mode === 'browser') {
      // Construct UPI URL and try to open it
      const upiUrl = `upi://pay?pa=${encodeURIComponent(paymentParams.pa)}&pn=${encodeURIComponent(paymentParams.pn)}&am=${paymentParams.am}&tn=${encodeURIComponent(paymentParams.tn)}&cu=${paymentParams.cu}`;
      
      try {
        window.location.href = upiUrl;
        setResult({ 
          action: 'opened',
          url: upiUrl,
          note: 'Attempted to open UPI URL. If no app opened, no UPI handler is installed.'
        });
        setStatus('success');
        markStepComplete(3);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Failed to open UPI URL' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.triggerUPIPayment) {
          throw new Error('NativeBridge.triggerUPIPayment not available');
        }
        const res = callNativeBridge<{ success?: boolean; status?: string; error?: string }>(
          () => window.NativeBridge?.triggerUPIPayment?.(JSON.stringify({
            ...paymentParams,
            packageName,
          }))
        );
        if (res) {
          setResult(res);
          setStatus(res.status === 'launched' ? 'success' : 'idle');
          markStepComplete(3);
        } else {
          setResult({ note: 'UPI app launching...' });
        }
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native payment failed' });
        setStatus('error');
      }
    }
  };

  const browserCode = `// Browser: UPI deep links
// Can only try to open - cannot detect apps or get response

const paymentParams = {
  pa: 'testupihandler@ibl',  // Payee VPA (UPI ID)
  pn: 'Manish',  // Payee display name
  am: '1.00',         // Amount
  tn: 'Order #12345',   // Transaction note
  cu: 'INR',            // Currency
  tr: 'TXN123456',      // Transaction reference (optional)
};

// Construct UPI URL
const upiUrl = new URL('upi://pay');
Object.entries(paymentParams).forEach(([key, value]) => {
  upiUrl.searchParams.set(key, value);
});

// Try to open (works on mobile with UPI app)
window.location.href = upiUrl.toString();
// OR
window.open(upiUrl.toString(), '_blank');

// LIMITATIONS:
// 1. Cannot detect if UPI app is installed
// 2. Cannot know if payment succeeded or failed
// 3. User may not return to your page after payment
// 4. Need server-side webhook to confirm payment

// For production, use a payment gateway (Razorpay, PayU, etc.)
// that handles UPI with proper callbacks`;

  const webviewCode = `// JavaScript - Check UPI support
const support = await window.NativeBridge.checkUPISupport();
// Returns: { supported: true, platform: 'Android' }

// Get installed UPI apps
const apps = await window.NativeBridge.getUPIApps();
// Returns: { apps: [{ packageName: 'com.google.android.apps.nbu.paisa.user', appName: 'Google Pay' }, ...] }

// Trigger payment with specific app
const result = await window.NativeBridge.triggerUPIPayment({
  pa: 'testupihandler@ibl',
  pn: 'Manish',
  am: '1.00',
  tn: 'Order #12345',
  packageName: 'com.google.android.apps.nbu.paisa.user' // Optional: specific app
});
// Returns: { success: true, txnId: 'TXN123', status: 'SUCCESS' }

// Android Kotlin - Native Implementation
class UPIBridge(private val activity: Activity) {
  
  @JavascriptInterface
  fun checkUPISupport(): String {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("upi://pay"))
    val apps = activity.packageManager.queryIntentActivities(intent, 0)
    return JSONObject().apply {
      put("supported", apps.isNotEmpty())
      put("platform", "Android")
    }.toString()
  }
  
  @JavascriptInterface
  fun getUPIApps(): String {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("upi://pay"))
    val apps = activity.packageManager.queryIntentActivities(intent, 0)
    val appList = apps.map { info ->
      JSONObject().apply {
        put("packageName", info.activityInfo.packageName)
        put("appName", info.loadLabel(activity.packageManager).toString())
      }
    }
    return JSONObject().put("apps", JSONArray(appList)).toString()
  }
  
  @JavascriptInterface
  fun triggerUPIPayment(paramsJson: String) {
    val params = JSONObject(paramsJson)
    val uri = Uri.Builder()
      .scheme("upi")
      .authority("pay")
      .appendQueryParameter("pa", params.getString("pa"))
      .appendQueryParameter("pn", params.getString("pn"))
      .appendQueryParameter("am", params.getString("am"))
      .appendQueryParameter("tn", params.getString("tn"))
      .appendQueryParameter("cu", "INR")
      .build()
    
    val intent = Intent(Intent.ACTION_VIEW, uri)
    params.optString("packageName")?.let { pkg ->
      intent.setPackage(pkg)
    }
    activity.startActivityForResult(intent, UPI_REQUEST_CODE)
  }
  
  // Handle result in Activity
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == UPI_REQUEST_CODE) {
      val response = data?.getStringExtra("response")
      // Parse response: txnId=XXX&responseCode=00&Status=SUCCESS&txnRef=XXX
      val result = parseUPIResponse(response)
      webView.evaluateJavascript("window.onUPIResult(\${result.toJson()})", null)
    }
  }
}

// iOS - UPI not natively supported
// Use payment gateways (Razorpay, PayU) that handle UPI via their SDK`;

  const browserPros = [
    'No native code needed',
    'Works if user has UPI app installed',
    'Simple implementation',
  ];
  const browserCons = [
    'Cannot detect installed UPI apps',
    'No callback - cannot know payment result',
    'User may not return to website',
    'Only works on mobile devices',
    'Need server webhook for confirmation',
    'Poor UX - no app selection UI',
  ];
  const webviewPros = [
    'Can list all installed UPI apps',
    'User can choose preferred app',
    'Get payment result callback',
    'Better UX with app icons',
    'Handle success/failure in app',
    'Transaction status immediately available',
  ];
  const webviewCons = [
    'Requires Android app wrapper',
    'iOS has no native UPI support',
    'More complex implementation',
    'Need to handle edge cases (app not responding)',
    'App store guidelines for payments',
  ];

  return (
    <div className="p-4">
      <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} completedSteps={completedSteps} />

      <div className="mt-4 space-y-4">
        {currentStep === 0 && (
          <Card title="Browser vs WebView: UPI Intent" description="Compare approaches for UPI payments">
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${mode === 'browser' ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <h4 className="font-semibold mb-3">🌐 Browser Mode</h4>
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
                <h4 className="font-semibold mb-3">📱 WebView Mode</h4>
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
                For <strong>Browser</strong>, use a payment gateway (Razorpay, PayU) that handles UPI with proper callbacks.
                For <strong>WebView</strong>, native UPI intent gives best UX with app selection and instant result.
              </p>
            </div>
            <Button onClick={goToNextStep} className="mt-4">Continue to Implementation →</Button>
          </Card>
        )}

        {currentStep === 1 && (
          <Card title="Step 1: Check UPI Support" description={mode === 'browser' ? 'Check if mobile device' : 'Query installed apps'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="UPI Available" value={upiSupported === null ? '—' : upiSupported ? '✓ Yes' : '✗ No'} status={upiSupported === null ? 'idle' : upiSupported ? 'success' : 'error'} />
              <StatusBadge label="Mode" value={mode === 'browser' ? '🌐 Browser' : '📱 WebView'} status="idle" />
            </div>
            <Button onClick={checkSupport} loading={status === 'pending'}>Check UPI Support</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(1) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 2 && (
          <Card title="Step 2: Get UPI Handlers" description="List installed UPI applications">
            {mode === 'browser' ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <div className="text-yellow-400 font-medium">Limited in Browser</div>
                <div className="text-sm text-text-muted mt-1">
                  Browser cannot detect installed apps. When you trigger UPI, the OS will show available handlers.
                </div>
              </div>
            ) : handlers ? (
              <div className="space-y-2 mb-4">
                {handlers.map((app) => (
                  <div key={app.packageName} className="flex items-center gap-3 p-3 bg-bg-elevated rounded-lg">
                    <span className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">💳</span>
                    <div>
                      <div className="font-medium">{app.appName}</div>
                      <div className="text-xs text-text-muted">{app.packageName}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <Button onClick={getHandlers} loading={status === 'pending'}>
              {mode === 'browser' ? 'Check Handlers (Limited)' : 'Get UPI Apps'}
            </Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(2) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 3 && (
          <Card title="Step 3: Trigger UPI Payment" description="Open UPI app for payment">
            <div className="bg-bg-elevated rounded-lg p-4 mb-4">
              <div className="text-sm text-text-muted mb-2">Test Payment Details</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Payee: testupihandler@ibl</div>
                <div>Amount: ₹1.00</div>
              </div>
            </div>
            
            {mode === 'webview' && handlers && handlers.length > 0 ? (
              <div className="space-y-2 mb-4">
                <div className="text-sm font-medium">Select UPI App:</div>
                {handlers.map((app) => (
                  <button
                    key={app.packageName}
                    onClick={() => triggerIntent(app.packageName)}
                    disabled={status === 'pending'}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      selectedApp === app.packageName
                        ? 'bg-accent text-white'
                        : 'bg-bg-elevated hover:bg-border'
                    }`}
                  >
                    <span>💳</span>
                    <span className="font-medium">{app.appName}</span>
                    {selectedApp === app.packageName && status === 'pending' && (
                      <span className="ml-auto w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <Button onClick={() => triggerIntent()} loading={status === 'pending'}>
                💳 Open UPI Payment
              </Button>
            )}
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(3) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 4 && (
          <Card title="Implementation Code" description={`${mode === 'browser' ? 'Browser' : 'WebView + Native'} implementation`}>
            <CodeBlock code={mode === 'browser' ? browserCode : webviewCode} />
            <Button onClick={() => { setCurrentStep(0); setCompletedSteps(new Set()); setResult(null); setStatus('idle'); }} variant="ghost" className="mt-3">← Start Over</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
