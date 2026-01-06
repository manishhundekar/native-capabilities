export interface FileInfo {
  name: string;
  size: string;
  type: string;
  lastModified?: string;
}

export interface UPIApp {
  packageName: string;
  appName: string;
}

// Android @JavascriptInterface returns JSON strings synchronously
export interface NativeBridgeInterface {
  // Camera
  checkCameraSupport?: () => string;
  requestCameraPermission?: () => string;
  capturePhoto?: (optionsJson: string) => string;
  
  // Location
  checkLocationSupport?: () => string;
  requestLocationPermission?: () => string;
  getCurrentLocation?: (optionsJson: string) => string;
  
  // UPI
  checkUPISupport?: () => string;
  getUPIApps?: () => string;
  triggerUPIPayment?: (paramsJson: string) => string;
  
  // Push Notifications
  checkPushSupport?: () => string;
  requestPushPermission?: () => string;
  registerForPush?: () => string;
  
  // File Picker
  checkFilePickerSupport?: () => string;
  selectFiles?: (optionsJson: string) => string;
  
  // Payments
  checkPaymentSupport?: () => string;
  initiatePayment?: (paramsJson: string) => string;
}

// Helper to call NativeBridge and parse JSON response
export function callNativeBridge<T>(method: () => string | undefined): T | null {
  try {
    const result = method();
    if (result) {
      return JSON.parse(result) as T;
    }
  } catch (e) {
    console.error('NativeBridge call failed:', e);
  }
  return null;
}

export interface RazorpayOptions {
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

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

declare global {
  interface Window {
    NativeBridge?: NativeBridgeInterface;
    showOpenFilePicker?: (options?: { types?: { description: string; accept: Record<string, string[]> }[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export {};
