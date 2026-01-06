'use client';

import '@/lib/types';
import { callNativeBridge } from '@/lib/types';

import { useState, useRef } from 'react';
import { Stepper, Card, Button, StatusBadge, CodeBlock, Result } from '@/components';

const steps = [
  { id: 'compare', title: 'Compare', description: 'Pros & cons of each mode' },
  { id: 'check', title: 'Check Support', description: 'Verify camera API availability' },
  { id: 'permission', title: 'Get Permission', description: 'Request camera access' },
  { id: 'capture', title: 'Capture', description: 'Take a photo' },
  { id: 'code', title: 'Code', description: 'Implementation details' },
];

interface Props { mode: 'browser' | 'webview'; }


export default function CameraDemo({ mode }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [apiSupported, setApiSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        const isSecure = typeof location !== 'undefined' && 
          (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
        const hasMediaDevices = typeof navigator !== 'undefined' && 'mediaDevices' in navigator;
        const hasGetUserMedia = hasMediaDevices && 'getUserMedia' in navigator.mediaDevices;
        
        if (!isSecure) {
          setApiSupported(false);
          setResult({ 
            error: 'Camera requires HTTPS',
            protocol: location.protocol,
            hostname: location.hostname,
            solution: 'Access via HTTPS or localhost. Use ngrok for mobile testing: npx ngrok http 3000'
          });
          setStatus('error');
          return;
        }
        
        let cameras: MediaDeviceInfo[] = [];
        if (hasMediaDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            cameras = devices.filter(d => d.kind === 'videoinput');
          } catch {
            // enumerateDevices may fail without permission on some browsers
          }
        }
        
        setApiSupported(hasGetUserMedia);
        setResult({ 
          secureContext: isSecure,
          mediaDevices: hasMediaDevices,
          getUserMedia: hasGetUserMedia,
          camerasFound: cameras.length,
          cameras: cameras.length > 0 ? cameras.map(c => c.label || 'Camera ' + c.deviceId.slice(0, 8)) : 'Will detect after permission granted'
        });
        setStatus(hasGetUserMedia ? 'success' : 'error');
        if (hasGetUserMedia) markStepComplete(1);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Failed to check support' });
        setStatus('error');
      }
    } else {
      // WebView - call native bridge
      try {
        if (!window.NativeBridge?.checkCameraSupport) {
          throw new Error('NativeBridge.checkCameraSupport not available. Are you running in a WebView with native bridge?');
        }
        const res = callNativeBridge<{ supported: boolean; cameras: string[] }>(
          () => window.NativeBridge?.checkCameraSupport?.()
        );
        if (res) {
          setApiSupported(res.supported);
          setResult(res);
          setStatus(res.supported ? 'success' : 'error');
          if (res.supported) markStepComplete(1);
        } else {
          throw new Error('Failed to parse NativeBridge response');
        }
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
        // Actually request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        
        setPermission('granted');
        setResult({ permission: 'granted', message: 'Camera access granted by user' });
        setStatus('success');
        markStepComplete(2);
      } catch (err) {
        const error = err as Error;
        let permState = 'denied';
        let solution = '';
        
        if (error.name === 'NotAllowedError') {
          permState = 'denied';
          solution = 'User denied permission. On mobile, check browser settings > Site settings > Camera';
        } else if (error.name === 'NotFoundError') {
          permState = 'no-camera';
          solution = 'No camera found on this device';
        } else if (error.name === 'NotReadableError') {
          permState = 'in-use';
          solution = 'Camera is being used by another app. Close other apps using camera.';
        } else if (error.name === 'OverconstrainedError') {
          permState = 'constraints';
          solution = 'Camera does not support requested constraints';
        } else if (error.name === 'SecurityError') {
          permState = 'security';
          solution = 'Camera blocked due to security policy. Ensure HTTPS.';
        }
        
        setPermission(permState);
        setResult({ 
          permission: permState, 
          error: error.message,
          errorName: error.name,
          solution
        });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.requestCameraPermission) {
          throw new Error('NativeBridge.requestCameraPermission not available');
        }
        const res = callNativeBridge<{ granted: boolean }>(
          () => window.NativeBridge?.requestCameraPermission?.()
        );
        if (res) {
          setPermission(res.granted ? 'granted' : 'denied');
          setResult({ ...res, note: res.granted ? 'Permission granted' : 'Permission will be requested when capturing' });
          setStatus('success'); // Always success - permission dialog shown or will be shown
          markStepComplete(2);
        } else {
          throw new Error('Failed to parse response');
        }
      } catch (err) {
        setPermission('error');
        setResult({ error: err instanceof Error ? err.message : 'Native bridge call failed' });
        setStatus('error');
      }
    }
  };

  const capturePhoto = async () => {
    setStatus('pending');
    setResult(null);
    setPreview(null);
    
    if (mode === 'browser') {
      try {
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        streamRef.current = stream;
        
        // Create video element and wait for it to be ready
        const video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        await video.play();
        
        // Wait a moment for camera to stabilize
        await new Promise(r => setTimeout(r, 500));
        
        // Capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        // Stop stream
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPreview(dataUrl);
        
        setResult({ 
          success: true,
          width: canvas.width,
          height: canvas.height,
          size: Math.round(dataUrl.length * 0.75 / 1024) + ' KB',
          format: 'JPEG'
        });
        setStatus('success');
        markStepComplete(3);
      } catch (err) {
        streamRef.current?.getTracks().forEach(t => t.stop());
        setResult({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Capture failed' 
        });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.capturePhoto) {
          throw new Error('NativeBridge.capturePhoto not available');
        }
        // Set up callback for async camera result
        (window as unknown as { onCameraResult: (result: { base64?: string; width?: number; height?: number; error?: string }) => void }).onCameraResult = (result) => {
          if (result.base64) {
            setPreview('data:image/jpeg;base64,' + result.base64);
            setResult({ success: true, width: result.width, height: result.height });
            setStatus('success');
            markStepComplete(3);
          } else {
            setResult({ error: result.error || 'Camera cancelled' });
            setStatus('error');
          }
        };
        // Call native - it will call onCameraResult when done
        window.NativeBridge.capturePhoto(JSON.stringify({ facingMode: 'environment', quality: 0.85 }));
        setResult({ status: 'Camera opening...' });
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native capture failed' });
        setStatus('error');
      }
    }
  };

  const browserCode = `// Check camera support
const hasCamera = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

// List available cameras
const devices = await navigator.mediaDevices.enumerateDevices();
const cameras = devices.filter(d => d.kind === 'videoinput');

// Request permission & get stream
const stream = await navigator.mediaDevices.getUserMedia({
  video: { 
    facingMode: 'environment', // or 'user' for front camera
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
});

// Display in video element
const video = document.querySelector('video');
video.srcObject = stream;
await video.play();

// Capture frame to canvas
const canvas = document.createElement('canvas');
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
canvas.getContext('2d').drawImage(video, 0, 0);

// Get image data
const imageData = canvas.toDataURL('image/jpeg', 0.85);

// Stop camera when done
stream.getTracks().forEach(track => track.stop());`;

  const webviewCode = `// JavaScript - Check support via native bridge
const support = await window.NativeBridge.checkCameraSupport();
// Returns: { supported: true, cameras: ['Back Camera', 'Front Camera'] }

// Request permission
const permission = await window.NativeBridge.requestCameraPermission();
// Returns: { granted: true }

// Capture photo
const photo = await window.NativeBridge.capturePhoto({
  facingMode: 'environment',
  quality: 0.85
});
// Returns: { base64: '...', width: 1920, height: 1080 }

// Android Kotlin - Native Implementation
@JavascriptInterface
fun checkCameraSupport(): String {
  val hasCamera = packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
  val cameras = cameraManager.cameraIdList.map { id ->
    val chars = cameraManager.getCameraCharacteristics(id)
    val facing = chars.get(CameraCharacteristics.LENS_FACING)
    if (facing == CameraCharacteristics.LENS_FACING_BACK) "Back" else "Front"
  }
  return JSONObject().apply {
    put("supported", hasCamera)
    put("cameras", JSONArray(cameras))
  }.toString()
}

@JavascriptInterface
fun capturePhoto(optionsJson: String): String {
  val options = JSONObject(optionsJson)
  val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
  // Handle in onActivityResult
}

// iOS Swift - Native Implementation
func checkCameraSupport() -> String {
  let devices = AVCaptureDevice.DiscoverySession(
    deviceTypes: [.builtInWideAngleCamera],
    mediaType: .video,
    position: .unspecified
  ).devices
  
  let cameras = devices.map { $0.position == .back ? "Back" : "Front" }
  return ["supported": !devices.isEmpty, "cameras": cameras].jsonString
}`;

  const browserPros = [
    'Works on any device with a browser',
    'No app installation required',
    'Cross-platform with single codebase',
    'Instant updates without app store',
  ];
  const browserCons = [
    'Requires HTTPS in production',
    'Limited camera controls (no manual focus, ISO)',
    'Cannot access camera in background',
    'Some browsers block camera on HTTP',
    'User must grant permission each session (some browsers)',
  ];
  const webviewPros = [
    'Full camera hardware access',
    'Manual controls (focus, ISO, exposure)',
    'Can save to device gallery',
    'Background camera access possible',
    'Better performance for video processing',
    'Access to native camera UI',
  ];
  const webviewCons = [
    'Requires native app wrapper',
    'Platform-specific code (Android/iOS)',
    'App store approval needed',
    'Larger app size',
    'More complex development setup',
  ];

  return (
    <div className="p-4">
      <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} completedSteps={completedSteps} />

      <div className="mt-4 space-y-4">
        {currentStep === 0 && (
          <Card title="Browser vs WebView: Camera" description="Compare approaches for camera access">
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${mode === 'browser' ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <h4 className="font-semibold mb-3 flex items-center gap-2">🌐 Browser Mode</h4>
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
                <h4 className="font-semibold mb-3 flex items-center gap-2">📱 WebView Mode</h4>
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
                Use <strong>Browser</strong> for simple photo capture in web apps. 
                Use <strong>WebView</strong> when you need advanced camera controls, native camera UI, or background access.
              </p>
            </div>
            <Button onClick={goToNextStep} className="mt-4">Continue to Implementation →</Button>
          </Card>
        )}

        {currentStep === 1 && (
          <Card title="Step 1: Check Camera Support" description={mode === 'browser' ? 'Using MediaDevices API' : 'Using Native Bridge'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="API Available" value={apiSupported === null ? '—' : apiSupported ? '✓ Yes' : '✗ No'} status={apiSupported === null ? 'idle' : apiSupported ? 'success' : 'error'} />
              <StatusBadge label="Mode" value={mode === 'browser' ? '🌐 Browser' : '📱 WebView'} status="idle" />
            </div>
            <Button onClick={checkSupport} loading={status === 'pending'}>Check Camera Support</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(1) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 2 && (
          <Card title="Step 2: Request Permission" description={mode === 'browser' ? 'Browser will prompt user' : 'Native OS dialog'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="Permission" value={permission || '—'} status={permission === 'granted' ? 'success' : permission ? 'error' : 'idle'} />
              <StatusBadge label="Method" value={mode === 'browser' ? 'getUserMedia()' : 'Native Dialog'} status="idle" />
            </div>
            <Button onClick={requestPermission} loading={status === 'pending'}>Request Camera Permission</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(2) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 3 && (
          <Card title="Step 3: Capture Photo" description="Take a photo using the camera">
            {preview && (
              <div className="mb-4">
                <img src={preview} alt="Captured" className="w-full max-w-md mx-auto rounded-lg" />
              </div>
            )}
            <video ref={videoRef} className="hidden" playsInline muted />
            <Button onClick={capturePhoto} loading={status === 'pending'}>📷 Capture Photo</Button>
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
