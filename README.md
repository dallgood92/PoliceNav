# BlockWatch starter

A deliberately simple, glanceable iOS/Android Expo app for showing an officer's current block, street, direction of travel, GPS quality, and coordinates. It also includes mocked partners and a handoff to the phone's navigation app.

> Prototype only. Do not rely on this starter for dispatch, emergency response, officer safety, evidence, or other operational decisions. GPS, compass, reverse-geocoded addresses, and derived block numbers can be delayed, missing, or wrong.

## What is included

- Foreground high-accuracy GPS updates using `Location.Accuracy.BestForNavigation`
- Fastest practical foreground GPS delivery: every native fix updates the UI immediately; Android requests 250 ms updates and both platforms use a zero-meter distance filter (the OS ultimately controls delivery)
- Travel direction from GPS course while moving at least 1.5 m/s; compass-facing direction when slower or stopped
- Four glanceable direction labels: North, East, South, and West
- Reverse-geocoded street/locality, with only the slower address lookup throttled to roughly every 12 meters or 5 seconds
- Derived hundred-block when a usable street number exists (`1237` becomes `1200 BLOCK`)
- GPS accuracy and the timestamp supplied with the latest location
- Mock partner list with online/offline and good/weak/no-signal presence, distance estimates, detail screen, and native map-navigation handoff
- Denton County-first road/address lookup using the county's public 911 GIS layer, with native reverse geocoding as fallback
- Denton County/TxDOT highway reference-marker lookup when the device is on a recognized highway
- Service boundaries ready for a future API/WebSocket implementation

## Requirements

- Node.js 22.13 or newer (Expo SDK 57 requirement)
- npm
- For the fastest device test: Expo Go on an iPhone or Android phone
- For simulators: Xcode on macOS for iOS; Android Studio for Android

## Install

From this folder:

```bash
npm install
```

## Run with Expo Go (physical phone)

```bash
npx expo start
```

Keep the computer and phone on the same Wi-Fi network. Scan the QR code with the iPhone Camera app or with **Scan QR code** inside Expo Go on Android. If the phone cannot connect:

```bash
npx expo start --tunnel
```

A physical phone gives much more realistic GPS, speed, course, and compass results than a simulator.

## Run in an iOS Simulator

```bash
npm run ios
```

Or start the server with `npx expo start`, then press `i`. In Simulator, choose a simulated location under **Features > Location**. Compass/course values may be absent or unrealistic.

## Run in an Android Emulator

Start an emulator in Android Studio, then run:

```bash
npm run android
```

Or start the server with `npx expo start`, then press `a`. Use the emulator controls to provide a test route if you want changing coordinates.

## Native development builds

Expo Go is appropriate for this foreground-location prototype. When background tracking or custom native behavior is added, use a development build:

```bash
npx expo run:ios
npx expo run:android
```

Those commands generate the native `ios/` or `android/` folder locally, install the debug app, and start Expo. Rebuild after native dependency or app-configuration changes.

## Permissions

The app asks for foreground location permission at startup. The iOS permission text is configured in `app.json`; Android permissions are supplied by the `expo-location` config plugin. Select precise/high-accuracy location when the OS offers that choice.

This starter does **not** request background location. Foreground subscriptions stop when the app is backgrounded. Background tracking requires separate user messaging, OS permissions, native configuration, store-policy disclosures, privacy review, and a development/production build.

If permission is denied, enable location for BlockWatch in the device's Settings and reload the app.

## How the live location pipeline works

1. `useLiveLocation` requests foreground permission and starts GPS and compass subscriptions.
2. Every delivered GPS fix immediately updates coordinates, accuracy, time, speed, and course.
3. While moving, valid GPS course drives the `…BOUND` label. At low speed, compass heading drives `FACING …`.
4. Reverse geocoding runs only after enough movement or elapsed time. This avoids calling the resource-intensive device geocoder for every GPS fix.
5. A numeric street address is rounded down to its hundred to produce the display block.

Block derivation is intentionally conservative. If the geocoder does not supply a street number, the app says `BLOCK UNAVAILABLE`; it does not guess. Address numbering is jurisdiction-specific, and rounding an address is not a substitute for an authoritative municipal block dataset.

## Project structure

```text
App.js
src/
  components/   Glanceable location and partner UI
  hooks/        Live device state and partner subscriptions
  screens/      Home and partner-detail screens
  services/     Geocoding, navigation, and replaceable partner data adapters
  theme/        Shared colors
  utils/        Address, direction, and distance calculations
```

## Backend-ready partner design

`src/services/partnerService.js` is the seam for future real-time data. `usePartners` only depends on `subscribeToPartners(onPartners)`, so a later implementation can authenticate, connect to a WebSocket, validate incoming positions, reconnect with backoff, and return an unsubscribe function without changing the screens.

Partner presence is based on both a backend-reported connection state and heartbeat freshness. A partner is treated as offline when no heartbeat has arrived for 45 seconds, even if the last message claimed the device was online. Signal quality (`good` or `weak`) should eventually come from the partner device/backend; it must not be inferred solely from GPS accuracy.

## Denton County GIS

`src/services/dentonCountyService.js` queries Denton County's public ArcGIS services for nearby 911 address points, road centerlines, and highway reference markers. GPS coordinates and direction remain fully local and update independently, so a slow or unavailable GIS response cannot stop the live location display. Outside Denton County—or whenever the county service is unavailable—the app falls back to the device reverse geocoder.

The displayed highway value is the nearest official reference-marker post, not an interpolated exact milepoint. The app displays its straight-line distance and source to avoid presenting an estimate as an exact location. Public GIS availability and accuracy are not guaranteed; operational deployment should use an agency-approved data agreement, cached data, monitoring, and a controlled backend.

Before using partner location operationally, add freshness indicators, stale/offline handling, server timestamps, accuracy radii, authorization checks, encrypted transport, audit controls, retention rules, and an explicit agency privacy/security review.

## Roadmap

1. **Real-time partner sharing** — WebSocket presence and positions; freshness/accuracy display; reconnect and offline behavior.
2. **Backend** — Node.js service, validated message schema, spatial queries, rate limits, monitoring, and deployment configuration.
3. **Authentication and authorization** — agency identity provider, short-lived tokens, team membership, device enrollment, remote revocation, and least-privilege access.
4. **Background location** — explicit opt-in, task manager integration, platform permissions, battery tuning, store-policy compliance, and clear active-tracking indicators.
5. **Map handoff** — configurable Apple Maps/Google Maps/Waze choice, route mode, and graceful fallbacks. The starter already demonstrates a basic native map handoff.
6. **Authoritative blocks** — evaluate municipal GIS/address-range data rather than relying solely on reverse-geocoder street numbers.
7. **Highway reference markers** — implement `mileMarkerService` against an authoritative state DOT linear-reference source. For Texas, use TxDOT eLRS/reference-marker data; keep results asynchronous and display their age/source.
8. **Operational hardening** — tests, accessibility review, secure telemetry, threat modeling, incident response, data minimization, and field trials.

## Useful files

- `src/hooks/useLiveLocation.js` — foreground location, heading, and throttled reverse geocoding
- `src/utils/direction.js` — course/heading selection and compass labels
- `src/utils/address.js` — address formatting and hundred-block derivation
- `src/services/partnerService.js` — mocked partner adapter to replace with WebSockets
- `src/services/navigationService.js` — native maps handoff

## Notes

- GPS course is only selected when reported speed is at least 1.5 m/s (about 3.4 mph); below that, the display uses compass heading.
- `timeInterval` applies to Android. iOS decides update timing based on the requested accuracy and distance filter.
- Continuous navigation-grade accuracy increases battery use.
- Mock partner coordinates are demo data near Denton, Texas and are clearly labeled in the UI.
