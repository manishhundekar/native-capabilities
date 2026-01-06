'use client';

import '@/lib/types';
import { callNativeBridge } from '@/lib/types';

import { useState } from 'react';
import { Stepper, Card, Button, StatusBadge, CodeBlock, Result } from '@/components';

const steps = [
  { id: 'compare', title: 'Compare', description: 'Pros & cons of each mode' },
  { id: 'check', title: 'Check Support', description: 'Verify geolocation API' },
  { id: 'permission', title: 'Get Permission', description: 'Request location access' },
  { id: 'location', title: 'Get Location', description: 'Fetch current position' },
  { id: 'code', title: 'Code', description: 'Implementation details' },
];

interface Props { mode: 'browser' | 'webview'; }


export default function LocationDemo({ mode }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [apiSupported, setApiSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

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
        const hasGeolocation = 'geolocation' in navigator;
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
        
        setApiSupported(hasGeolocation && isSecure);
        setResult({ 
          geolocationAPI: hasGeolocation,
          secureContext: isSecure,
          protocol: location.protocol,
          note: !isSecure ? 'Geolocation requires HTTPS' : undefined
        });
        setStatus(hasGeolocation && isSecure ? 'success' : 'error');
        if (hasGeolocation && isSecure) markStepComplete(1);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Check failed' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.checkLocationSupport) {
          throw new Error('NativeBridge.checkLocationSupport not available. Are you running in a WebView with native bridge?');
        }
        const res = callNativeBridge<{ supported: boolean; gpsEnabled: boolean }>(
          () => window.NativeBridge?.checkLocationSupport?.()
        );
        if (res) {
          setApiSupported(res.supported);
          setResult(res);
          setStatus(res.supported ? 'success' : 'error');
          if (res.supported) markStepComplete(1);
        } else {
          throw new Error('Failed to parse response');
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
        // Check permission state first
        const permResult = await navigator.permissions.query({ name: 'geolocation' });
        
        if (permResult.state === 'granted') {
          setPermission('granted');
          setResult({ permission: 'granted', message: 'Already have location permission' });
          setStatus('success');
          markStepComplete(2);
        } else if (permResult.state === 'denied') {
          setPermission('denied');
          setResult({ permission: 'denied', message: 'Location access was denied. Reset in browser settings.' });
          setStatus('error');
        } else {
          // Prompt - need to actually request location to trigger prompt
          setPermission('prompt');
          setResult({ permission: 'prompt', message: 'Will prompt when you request location' });
          setStatus('success');
          markStepComplete(2);
        }
      } catch {
        // Permissions API not supported, will prompt on location request
        setPermission('prompt');
        setResult({ permission: 'prompt', message: 'Will prompt when you request location' });
        setStatus('success');
        markStepComplete(2);
      }
    } else {
      try {
        if (!window.NativeBridge?.requestLocationPermission) {
          throw new Error('NativeBridge.requestLocationPermission not available');
        }
        const res = callNativeBridge<{ granted: boolean; precision: string }>(
          () => window.NativeBridge?.requestLocationPermission?.()
        );
        if (res) {
          setPermission(res.granted ? 'granted' : 'prompt');
          setResult({ ...res, note: res.granted ? 'Permission granted' : 'Permission will be requested when fetching location' });
          setStatus('success');
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

  const getLocation = async () => {
    setStatus('pending');
    setResult(null);
    setCoords(null);
    
    if (mode === 'browser') {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        });
        
        const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setResult({ 
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          accuracy: `±${accuracy.toFixed(0)}m`,
          altitude: altitude ? `${altitude.toFixed(1)}m` : null,
          speed: speed ? `${(speed * 3.6).toFixed(1)} km/h` : null,
          heading: heading ? `${heading.toFixed(0)}°` : null,
          timestamp: new Date(position.timestamp).toISOString()
        });
        setStatus('success');
        markStepComplete(3);
      } catch (err) {
        const error = err as GeolocationPositionError;
        let message = error.message;
        if (error.code === 1) message = 'Permission denied by user';
        else if (error.code === 2) message = 'Position unavailable';
        else if (error.code === 3) message = 'Request timed out';
        
        setResult({ error: message, code: error.code });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.getCurrentLocation) {
          throw new Error('NativeBridge.getCurrentLocation not available');
        }
        // Set up callback for async location result
        (window as unknown as { onLocationResult: (result: { latitude?: number; longitude?: number; accuracy?: number; error?: string }) => void }).onLocationResult = (result) => {
          if (result.latitude !== undefined) {
            setCoords({ lat: result.latitude, lng: result.longitude!, accuracy: result.accuracy! });
            setResult(result);
            setStatus('success');
            markStepComplete(3);
          } else {
            setResult({ error: result.error || 'Location failed' });
            setStatus('error');
          }
        };
        // Call native - it will call onLocationResult when done
        window.NativeBridge.getCurrentLocation(JSON.stringify({ highAccuracy: true, timeout: 15000 }));
        setResult({ status: 'Fetching location...' });
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native location failed' });
        setStatus('error');
      }
    }
  };

  const browserCode = `// Check support
const hasGeolocation = 'geolocation' in navigator;
const isSecure = location.protocol === 'https:';

// Check permission state
const permission = await navigator.permissions.query({ name: 'geolocation' });
console.log(permission.state); // 'granted', 'denied', 'prompt'

// Get current position
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude, accuracy, altitude, speed } = position.coords;
    console.log(\`Location: \${latitude}, \${longitude}\`);
    console.log(\`Accuracy: ±\${accuracy}m\`);
  },
  (error) => {
    switch (error.code) {
      case 1: console.error('Permission denied'); break;
      case 2: console.error('Position unavailable'); break;
      case 3: console.error('Timeout'); break;
    }
  },
  {
    enableHighAccuracy: true,  // Use GPS if available
    timeout: 15000,            // Max wait time
    maximumAge: 0              // Don't use cached position
  }
);

// Watch position (continuous updates)
const watchId = navigator.geolocation.watchPosition(
  (position) => { /* handle update */ },
  (error) => { /* handle error */ },
  { enableHighAccuracy: true }
);

// Stop watching
navigator.geolocation.clearWatch(watchId);`;

  const webviewCode = `// JavaScript - Check support via native bridge
const support = await window.NativeBridge.checkLocationSupport();
// Returns: { supported: true, gpsEnabled: true }

// Request permission
const permission = await window.NativeBridge.requestLocationPermission();
// Returns: { granted: true, precision: 'fine' }

// Get current location
const location = await window.NativeBridge.getCurrentLocation({
  highAccuracy: true,
  timeout: 15000
});
// Returns: { latitude: 37.422, longitude: -122.084, accuracy: 5, altitude: 10, speed: 0 }

// Android Kotlin - Using FusedLocationProvider
class LocationBridge(private val activity: Activity) {
  private val fusedClient = LocationServices.getFusedLocationProviderClient(activity)
  
  @JavascriptInterface
  fun checkLocationSupport(): String {
    val locationManager = activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
    return JSONObject().apply {
      put("supported", true)
      put("gpsEnabled", gpsEnabled)
    }.toString()
  }
  
  @JavascriptInterface
  fun getCurrentLocation(optionsJson: String): String {
    val options = JSONObject(optionsJson)
    val priority = if (options.getBoolean("highAccuracy")) 
      Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY
    
    val result = CompletableFuture<Location>()
    fusedClient.getCurrentLocation(priority, null)
      .addOnSuccessListener { result.complete(it) }
      .addOnFailureListener { result.completeExceptionally(it) }
    
    val location = result.get(options.getLong("timeout"), TimeUnit.MILLISECONDS)
    return JSONObject().apply {
      put("latitude", location.latitude)
      put("longitude", location.longitude)
      put("accuracy", location.accuracy)
      put("altitude", location.altitude)
      put("speed", location.speed)
    }.toString()
  }
}

// iOS Swift - Using CoreLocation
class LocationBridge: NSObject, CLLocationManagerDelegate {
  let manager = CLLocationManager()
  
  func checkLocationSupport() -> String {
    let enabled = CLLocationManager.locationServicesEnabled()
    return ["supported": enabled, "gpsEnabled": enabled].jsonString
  }
  
  func getCurrentLocation(highAccuracy: Bool, completion: @escaping (String) -> Void) {
    manager.desiredAccuracy = highAccuracy ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
    manager.requestLocation()
  }
  
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else { return }
    let result = [
      "latitude": loc.coordinate.latitude,
      "longitude": loc.coordinate.longitude,
      "accuracy": loc.horizontalAccuracy,
      "altitude": loc.altitude,
      "speed": loc.speed
    ]
    // Send to WebView
  }
}`;

  const browserPros = [
    'Works in any modern browser',
    'No app installation needed',
    'Simple API - single function call',
    'Cross-platform with same code',
    'HTTPS ensures data security',
  ];
  const browserCons = [
    'Requires HTTPS (except localhost)',
    'Less accurate than native GPS',
    'Cannot access location in background',
    'Higher battery usage with enableHighAccuracy',
    'User prompted every session (some browsers)',
  ];
  const webviewPros = [
    'Access to FusedLocationProvider (Android) / CoreLocation (iOS)',
    'Better accuracy with GPS hardware',
    'Background location updates possible',
    'Geofencing support',
    'Lower battery usage with native optimization',
    'Fine vs coarse permission control',
  ];
  const webviewCons = [
    'Requires native app wrapper',
    'Platform-specific implementation',
    'More complex permission handling',
    'App store review for location usage',
    'Must declare location usage in manifest/plist',
  ];

  return (
    <div className="p-4">
      <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} completedSteps={completedSteps} />

      <div className="mt-4 space-y-4">
        {currentStep === 0 && (
          <Card title="Browser vs WebView: Location" description="Compare approaches for location access">
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
                Use <strong>Browser</strong> for basic location needs (store locator, delivery address). 
                Use <strong>WebView</strong> for ride-sharing, fitness tracking, or apps needing background location.
              </p>
            </div>
            <Button onClick={goToNextStep} className="mt-4">Continue to Implementation →</Button>
          </Card>
        )}

        {currentStep === 1 && (
          <Card title="Step 1: Check Geolocation Support" description={mode === 'browser' ? 'Using Geolocation API' : 'Using Native Bridge'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="API Available" value={apiSupported === null ? '—' : apiSupported ? '✓ Yes' : '✗ No'} status={apiSupported === null ? 'idle' : apiSupported ? 'success' : 'error'} />
              <StatusBadge label="Mode" value={mode === 'browser' ? '🌐 Browser' : '📱 WebView'} status="idle" />
            </div>
            <Button onClick={checkSupport} loading={status === 'pending'}>Check Location Support</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(1) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 2 && (
          <Card title="Step 2: Check/Request Permission" description={mode === 'browser' ? 'Browser Permissions API' : 'Native OS dialog'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="Permission" value={permission || '—'} status={permission === 'granted' ? 'success' : permission === 'denied' ? 'error' : 'idle'} />
              <StatusBadge label="Method" value={mode === 'browser' ? 'permissions.query()' : 'Native Dialog'} status="idle" />
            </div>
            <Button onClick={requestPermission} loading={status === 'pending'}>Check Permission</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(2) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 3 && (
          <Card title="Step 3: Get Current Location" description="Fetch GPS coordinates">
            {coords && (
              <div className="bg-bg-elevated rounded-lg p-4 mb-4 text-center">
                <div className="text-2xl font-semibold mb-1">📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
                <div className="text-sm text-text-muted">Accuracy: ±{coords.accuracy.toFixed(0)} meters</div>
              </div>
            )}
            <Button onClick={getLocation} loading={status === 'pending'}>📍 Get Current Location</Button>
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
