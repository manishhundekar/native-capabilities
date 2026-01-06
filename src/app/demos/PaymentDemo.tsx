'use client';

import '@/lib/types';
import { callNativeBridge } from '@/lib/types';

import { useState } from 'react';
import { Stepper, Card, Button, StatusBadge, CodeBlock, Result } from '@/components';

const steps = [
  { id: 'compare', title: 'Compare', description: 'Pros & cons of each mode' },
  { id: 'check', title: 'Check Support', description: 'Verify payment APIs' },
  { id: 'order', title: 'Create Order', description: 'Initialize payment' },
  { id: 'pay', title: 'Execute', description: 'Process payment' },
  { id: 'code', title: 'Code', description: 'Implementation details' },
];

interface Props { mode: 'browser' | 'webview'; }

type PaymentMethod = 'card' | 'upi' | 'netbanking';


interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id?: string;
  name: string;
  description?: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id?: string; razorpay_signature?: string }) => void;
  prefill?: { email?: string; contact?: string; method?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

export default function PaymentDemo({ mode }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [apiSupported, setApiSupported] = useState<boolean | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [amount] = useState(1); // ₹1 for testing

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
        const hasPaymentRequest = 'PaymentRequest' in window;
        const hasRazorpay = 'Razorpay' in window;
        
        let canMakePayment = false;
        if (hasPaymentRequest) {
          try {
            const request = new PaymentRequest(
              [{ supportedMethods: 'basic-card' }],
              { total: { label: 'Test', amount: { currency: 'INR', value: '1' } } }
            );
            canMakePayment = await request.canMakePayment() || false;
          } catch {
            canMakePayment = false;
          }
        }
        
        setApiSupported(hasPaymentRequest || hasRazorpay);
        setResult({ 
          PaymentRequestAPI: hasPaymentRequest,
          canMakePayment,
          RazorpaySDK: hasRazorpay,
          note: hasRazorpay 
            ? 'Razorpay SDK loaded - ready for payments' 
            : 'Load Razorpay SDK: <script src="https://checkout.razorpay.com/v1/checkout.js"></script>'
        });
        setStatus('success');
        markStepComplete(1);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Check failed' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.checkPaymentSupport) {
          throw new Error('NativeBridge.checkPaymentSupport not available. Are you running in a WebView with native bridge?');
        }
        const res = callNativeBridge<{ supported: boolean; methods: string[] }>(() => window.NativeBridge?.checkPaymentSupport?.());
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

  const createOrder = async () => {
    setStatus('pending');
    setResult(null);
    
    // In production, this would be a server API call
    // POST /api/orders { amount, currency }
    // Server creates order with Razorpay and returns order_id
    
    try {
      // Simulating server response
      const mockOrderId = 'order_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      
      setOrderId(mockOrderId);
      setResult({ 
        orderId: mockOrderId,
        amount: amount * 100, // paise
        currency: 'INR',
        note: 'In production, create order via server API: POST /api/razorpay/orders'
      });
      setStatus('success');
      markStepComplete(2);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Order creation failed' });
      setStatus('error');
    }
  };

  const executePayment = async () => {
    setStatus('pending');
    setResult(null);
    
    if (mode === 'browser') {
      // Check if Razorpay is loaded
      if (!window.Razorpay) {
        setResult({ 
          error: 'Razorpay SDK not loaded',
          action: 'Add this script to your HTML:',
          script: '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>'
        });
        setStatus('error');
        return;
      }
      
      try {
        const options: RazorpayOptions = {
          key: 'rzp_test_XXXXXXXXXX', // Replace with your test key
          amount: amount * 100,
          currency: 'INR',
          order_id: orderId || undefined,
          name: 'Test Store',
          description: 'Test Payment',
          handler: (response) => {
            setResult({
              success: true,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
            setStatus('success');
            markStepComplete(3);
          },
          prefill: {
            method: method,
          },
          theme: {
            color: '#3b82f6',
          },
          modal: {
            ondismiss: () => {
              setResult({ cancelled: true, message: 'Payment cancelled by user' });
              setStatus('idle');
            },
          },
        };
        
        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Payment failed' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.initiatePayment) {
          throw new Error('NativeBridge.initiatePayment not available');
        }
        const res = callNativeBridge<{ success: boolean; paymentId?: string; error?: string }>(
          () => window.NativeBridge?.initiatePayment?.(JSON.stringify({
            orderId: orderId || '',
            amount: amount * 100,
            method,
          }))
        );
        if (res) {
          setResult(res);
          setStatus(res.success ? 'success' : 'error');
          if (res.success) markStepComplete(3);
        } else {
          setResult({ note: 'Payment in progress...' });
        }
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native payment failed' });
        setStatus('error');
      }
    }
  };

  const browserCode = `// Step 1: Load Razorpay SDK
// <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

// Step 2: Create order on your server
const response = await fetch('/api/razorpay/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 10000, // ₹100 in paise
    currency: 'INR',
    receipt: 'order_receipt_123',
  }),
});
const order = await response.json();
// { id: 'order_xxx', amount: 10000, currency: 'INR' }

// Step 3: Open Razorpay Checkout
const options = {
  key: 'rzp_test_xxxxx', // Your Razorpay Key ID
  amount: order.amount,
  currency: order.currency,
  order_id: order.id,
  name: 'Your Store',
  description: 'Order #123',
  image: '/logo.png',
  handler: function(response) {
    // Payment successful
    console.log('Payment ID:', response.razorpay_payment_id);
    console.log('Order ID:', response.razorpay_order_id);
    console.log('Signature:', response.razorpay_signature);
    
    // Verify signature on server
    verifyPayment(response);
  },
  prefill: {
    name: 'Customer Name',
    email: 'customer@example.com',
    contact: '9999999999',
    method: 'upi', // or 'card', 'netbanking'
  },
  theme: {
    color: '#3b82f6',
  },
  modal: {
    ondismiss: function() {
      console.log('Payment cancelled');
    },
  },
};

const rzp = new Razorpay(options);
rzp.open();

// Server-side: Create order (Node.js)
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: 'rzp_test_xxxxx',
  key_secret: 'your_secret',
});

const order = await razorpay.orders.create({
  amount: 10000,
  currency: 'INR',
  receipt: 'order_123',
});`;

  const webviewCode = `// JavaScript - Check support
const support = await window.NativeBridge.checkPaymentSupport();
// Returns: { supported: true, methods: ['upi', 'card', 'netbanking'] }

// Initiate payment
const result = await window.NativeBridge.initiatePayment({
  orderId: 'order_xxx',
  amount: 10000, // paise
  method: 'upi'
});
// Returns: { success: true, paymentId: 'pay_xxx' }

// Android Kotlin - Razorpay Native SDK
class PaymentBridge(private val activity: Activity) : PaymentResultListener {
  
  private val razorpay = Checkout().apply {
    setKeyID("rzp_test_xxxxx")
  }
  
  @JavascriptInterface
  fun checkPaymentSupport(): String {
    return JSONObject().apply {
      put("supported", true)
      put("methods", JSONArray(listOf("upi", "card", "netbanking")))
    }.toString()
  }
  
  @JavascriptInterface
  fun initiatePayment(paramsJson: String) {
    val params = JSONObject(paramsJson)
    
    val options = JSONObject().apply {
      put("name", "Your Store")
      put("order_id", params.getString("orderId"))
      put("amount", params.getInt("amount"))
      put("currency", "INR")
      put("prefill", JSONObject().apply {
        put("method", params.getString("method"))
      })
    }
    
    activity.runOnUiThread {
      razorpay.open(activity, options)
    }
  }
  
  override fun onPaymentSuccess(paymentId: String) {
    webView.evaluateJavascript(
      "window.onPaymentResult({ success: true, paymentId: '$paymentId' })", null
    )
  }
  
  override fun onPaymentError(code: Int, message: String) {
    webView.evaluateJavascript(
      "window.onPaymentResult({ success: false, error: '$message' })", null
    )
  }
}

// iOS Swift - Razorpay SDK
class PaymentBridge: NSObject, RazorpayPaymentCompletionProtocol {
  
  var razorpay: RazorpayCheckout?
  
  func initiatePayment(orderId: String, amount: Int, method: String) {
    razorpay = RazorpayCheckout.initWithKey("rzp_test_xxxxx", andDelegate: self)
    
    let options: [String: Any] = [
      "amount": amount,
      "order_id": orderId,
      "currency": "INR",
      "name": "Your Store",
      "prefill": ["method": method]
    ]
    
    razorpay?.open(options)
  }
  
  func onPaymentSuccess(_ paymentId: String) {
    webView.evaluateJavaScript("window.onPaymentResult({ success: true, paymentId: '\\(paymentId)' })")
  }
  
  func onPaymentError(_ code: Int32, description: String) {
    webView.evaluateJavaScript("window.onPaymentResult({ success: false, error: '\\(description)' })")
  }
}`;

  const browserPros = [
    'No native code needed',
    'Works on all devices',
    'Razorpay handles all payment methods',
    'PCI DSS compliance handled by Razorpay',
    'Quick integration',
    'Test mode available',
  ];
  const browserCons = [
    'Popup-based checkout',
    'UPI requires redirect on mobile',
    'No access to installed UPI apps',
    'Less native feel',
    'Depends on network for Razorpay JS',
  ];
  const webviewPros = [
    'Native Razorpay SDK',
    'Direct UPI app selection',
    'Better UPI intent handling',
    'Smoother UX',
    'Better success rate for UPI',
    'Native UI elements',
  ];
  const webviewCons = [
    'Requires native SDK integration',
    'Platform-specific code',
    'App store distribution needed',
    'More complex setup',
    'SDK size adds to app',
  ];

  return (
    <div className="p-4">
      <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} completedSteps={completedSteps} />

      <div className="mt-4 space-y-4">
        {currentStep === 0 && (
          <Card title="Browser vs WebView: Payments" description="Compare payment integration approaches">
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${mode === 'browser' ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <h4 className="font-semibold mb-3">🌐 Browser Mode (Razorpay JS)</h4>
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
                <h4 className="font-semibold mb-3">📱 WebView Mode (Native SDK)</h4>
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
                Use <strong>Razorpay JS</strong> for web apps - it handles all payment methods well.
                Use <strong>Native SDK</strong> in WebView apps for better UPI success rates and native feel.
              </p>
            </div>
            <Button onClick={goToNextStep} className="mt-4">Continue to Implementation →</Button>
          </Card>
        )}

        {currentStep === 1 && (
          <Card title="Step 1: Check Payment Support" description={mode === 'browser' ? 'Payment Request API & Razorpay' : 'Native payment SDK'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="Payment APIs" value={apiSupported === null ? '—' : apiSupported ? '✓ Available' : 'Limited'} status={apiSupported === null ? 'idle' : apiSupported ? 'success' : 'idle'} />
              <StatusBadge label="Mode" value={mode === 'browser' ? '🌐 Razorpay JS' : '📱 Native SDK'} status="idle" />
            </div>
            <Button onClick={checkSupport} loading={status === 'pending'}>Check Payment Support</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(1) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 2 && (
          <Card title="Step 2: Create Order" description="Initialize payment on server">
            <div className="bg-bg-elevated rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Test Amount</span>
                <span className="text-2xl font-semibold">₹{amount}</span>
              </div>
            </div>
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Payment Method</div>
              <div className="flex gap-2">
                {(['upi', 'card', 'netbanking'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                      method === m ? 'bg-accent text-white' : 'bg-bg-elevated text-text-muted hover:text-text'
                    }`}
                  >
                    {m === 'upi' ? '📱 UPI' : m === 'card' ? '💳 Card' : '🏦 Bank'}
                  </button>
                ))}
              </div>
            </div>
            {orderId && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                <div className="text-xs text-text-muted">Order ID</div>
                <code className="text-sm">{orderId}</code>
              </div>
            )}
            <Button onClick={createOrder} loading={status === 'pending'}>Create Order</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(2) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 3 && (
          <Card title="Step 3: Execute Payment" description="Process the payment">
            <div className="bg-bg-elevated rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Order</span>
                <code className="text-sm">{orderId || 'Not created'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Method</span>
                <span>{method.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Amount</span>
                <span className="font-semibold">₹{amount}</span>
              </div>
            </div>
            
            {mode === 'browser' && !('Razorpay' in window) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                <div className="text-yellow-400 text-sm font-medium">Razorpay SDK Required</div>
                <div className="text-xs text-text-muted mt-1">
                  Add to your HTML: <code className="bg-bg text-xs p-1 rounded">&lt;script src=&quot;https://checkout.razorpay.com/v1/checkout.js&quot;&gt;&lt;/script&gt;</code>
                </div>
              </div>
            )}
            
            <Button onClick={executePayment} loading={status === 'pending'} disabled={!orderId}>
              💰 Pay ₹{amount}
            </Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(3) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 4 && (
          <Card title="Implementation Code" description={`${mode === 'browser' ? 'Razorpay JS' : 'Native SDK'} implementation`}>
            <CodeBlock code={mode === 'browser' ? browserCode : webviewCode} />
            <Button onClick={() => { setCurrentStep(0); setCompletedSteps(new Set()); setResult(null); setStatus('idle'); }} variant="ghost" className="mt-3">← Start Over</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
