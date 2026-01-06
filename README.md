# Native Capabilities Demo

A demonstration app comparing Browser vs WebView native capabilities for Camera, Location, UPI, Push Notifications, Document Upload, and Payments.

## Project Structure

```
misc/
├── native-demo/           # Web app (Next.js + Tailwind)
│   ├── src/app/           # Pages and demos
│   ├── src/components/    # UI components
│   ├── public/            # Static files + PWA assets
│   └── public/NativeDemo.apk  # Built Android APK
│
└── native-demo-android/   # Android app source
    ├── app/src/main/      # Kotlin source + manifest
    └── app/build/outputs/ # Built APK location
```

## Quick Start

### 1. Run Web App

```bash
cd /Users/Manish.11/ABCD/frontend/misc/native-demo
npm install
npm run dev
```

App runs at http://localhost:3000

### 2. Create HTTPS Tunnel (for mobile testing)

```bash
cloudflared tunnel --url http://localhost:3000
```

Use the `https://xxx.trycloudflare.com` URL on your phone.

### 3. Install as PWA (Browser Mode)

1. Open the HTTPS URL in Chrome/Samsung Internet on Android
2. Menu → "Add to Home screen"
3. Opens fullscreen like an app
4. Use **"🌐 Browser"** mode toggle

### 4. Install Android App (WebView Mode)

Transfer `/Users/Manish.11/ABCD/frontend/misc/native-demo/public/NativeDemo.apk` to your phone and install.

Or download via tunnel: `https://xxx.trycloudflare.com/NativeDemo.apk`

## Rebuild Android APK

### Prerequisites

- Java 11+ (already installed)
- Android SDK at `/opt/homebrew/share/android-commandlinetools/`

### Build Commands

```bash
cd /Users/Manish.11/ABCD/frontend/misc/native-demo-android

# Set environment
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools

# Download Gradle (if not cached)
curl -sL "https://services.gradle.org/distributions/gradle-8.2-bin.zip" -o /tmp/gradle-8.2.zip
unzip -q -o /tmp/gradle-8.2.zip -d /tmp/
export PATH="/tmp/gradle-8.2/bin:$PATH"

# Build debug APK
gradle assembleDebug

# APK location
ls -la app/build/outputs/apk/debug/app-debug.apk
```

### Update Web URL in Android App

Edit `app/src/main/java/com/nativedemo/MainActivity.kt`:

```kotlin
private const val WEB_URL = "https://YOUR-NEW-TUNNEL-URL.trycloudflare.com"
```

Then rebuild.

## Features Comparison

| Feature | Browser Mode | WebView Mode |
|---------|-------------|--------------|
| Camera | getUserMedia API | Native Intent |
| Location | Geolocation API | FusedLocationProvider |
| UPI Apps | Cannot detect | Lists installed apps |
| UPI Payment | Opens upi:// link | App chooser dialog |
| Push | Web Push API | FCM/APNs |
| Files | File Input | Native Picker |
| Payments | Razorpay JS | Native SDK |

## Tech Stack

**Web App:**
- Next.js 15
- React 19
- Tailwind CSS
- TypeScript

**Android App:**
- Kotlin
- WebView + JavascriptInterface
- FusedLocationProvider
- Material Components

## Useful Commands

```bash
# Start web dev server
cd native-demo && npm run dev

# Create tunnel
cloudflared tunnel --url http://localhost:3000

# Build web app
cd native-demo && npm run build

# Build Android APK
cd native-demo-android && gradle assembleDebug

# Clean Android build
cd native-demo-android && gradle clean
```

## Troubleshooting

### Camera/Location not working in browser
- Requires HTTPS (use cloudflared tunnel)
- Check browser permissions

### PWA not installing as fullscreen
- Must use HTTPS URL
- Clear site data and reinstall

### Android build fails
- Check Java version: `java -version` (need 11+)
- Check SDK: `ls $ANDROID_HOME/platforms/`
- Run `gradle clean` and retry

### NativeBridge not available
- You're in Browser mode, not the Android app
- Use PWA for browser APIs, Android app for NativeBridge
