# SquadNav

A deliberately simple, glanceable iOS/Android Expo app for showing an officer's current block, street, direction of travel, and GPS quality. It also includes live squad partners and a handoff to the phone's navigation app.

> Prototype only. Do not rely on this starter for dispatch, emergency response, officer safety, evidence, or other operational decisions. GPS, compass, reverse-geocoded addresses, and derived block numbers can be delayed, missing, or wrong.

## What is included

- Foreground high-accuracy GPS updates using `Location.Accuracy.BestForNavigation`
- Fastest practical foreground GPS delivery: every native fix updates the UI immediately; Android requests 250 ms updates and both platforms use a zero-meter distance filter (the OS ultimately controls delivery)
- Travel direction from GPS course while moving at least 1.5 m/s; compass-facing direction when slower or stopped
- Four glanceable direction labels: North, East, South, and West
- Reverse-geocoded street/locality, with only the slower address lookup throttled to roughly every 12 meters or 5 seconds
- Derived hundred-block when a usable street number exists (`1237` becomes `1200 BLOCK`)
- GPS accuracy and the timestamp supplied with the latest location
- Live partner WebSocket subscription with online/offline presence, a moving in-app map, an empty state before partners share, and a remembered Apple Maps/Google Maps preference
- Explicit on-duty background-sharing control that uploads navigation-grade GPS fixes over HTTPS
- A small Node.js WebSocket/HTTP reference server under `backend/`
- Push-assisted direction refresh: opening directions arms a movement watch; tapping the iOS alert fetches the newest partner position and reopens the selected map
- Device-based test profiles, department creation/join approvals, squad management, and squad-only dashboard visibility
- Denton County-first road/address lookup using the county's public 911 GIS layer, with native reverse geocoding as fallback
- Optional nearby-landmark context when the native geocoder returns a distinct named place; it is hidden when the result resembles an address or locality and never replaces the last valid street/block
- A no-scroll operational dashboard with portrait and landscape layouts, a compact Apple/Google Maps preference, two-column portrait partner tiles, and slim landscape partner rows
- Partner rosters sort automatically by pursuit, cover request, traffic stop, then clear; the partner area scrolls independently only when the roster exceeds the available space
- Full-screen pursuit mode emphasizing the current street, block, heading, locality, and upcoming/nearest cross street; squad partners see a restrained red/blue pursuit pulse
- Three development-only simulated partners appear when no live partners are available, making the compact all-unit layouts, status styling, map, and detail view testable without adding production data
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

## Background sharing and live partners

Background location does not work in Expo Go on iOS. Use a development build or TestFlight build. The user must explicitly start partner sharing and grant **Always** location access; the app shows the iOS background-location indicator while sharing.

The client intentionally has no production server address checked into source control. Copy `.env.example` to `.env` and set:

```text
EXPO_PUBLIC_LOCATION_API_URL=https://your-deployed-server.example.com
EXPO_PUBLIC_LOCATION_API_TOKEN=your-temporary-pilot-token
```

For the current pilot, each installation asks for first name, last name, call sign, and unit number. The generated device ID and profile are remembered locally and upserted in PostgreSQL, so reopening the app recognizes the same device without a login.

The department creator becomes its first admin and is placed in a default **Patrol** squad. Other signed-in users request access, an admin approves them, and then assigns them to one or more squads. The partner dashboard filters the live location stream to device IDs belonging to the signed-in officer's squads.

The first registration matching `Dylan Allgood` with call sign `875` bootstraps the Argyle Police Department and receives the admin role. Management access is subsequently enforced from that stored database role instead of a device ID.

These `EXPO_PUBLIC_*` values are embedded in the app binary and are **not secrets**. The shared token is suitable only for controlled demos. Before field use, replace it with authenticated users, short-lived device credentials, per-team authorization, remote revocation, audit logging, rate limiting, encrypted storage, and an agency-approved retention policy.

### Local database and partner server

Docker runs PostgreSQL for durable accounts, departments, requests, and squads. Redis holds the latest partner positions and navigation watches for fast reads and live updates.

Start both data services from the project folder:

```bash
docker compose up -d
```

Then start the partner server in a second terminal:

```bash
cd backend
npm install
npm start
```

The included local `backend/.env` is ignored by Git and is already configured for this Docker stack. Check that everything is ready at `http://localhost:8787/health`. To stop the data services, run `docker compose stop`. Starting them again retains the saved data. Do not run `docker compose down -v` unless you intentionally want to erase the local database and Redis data.

For two physical phones or TestFlight, deploy `backend/` to a Node host with HTTPS/WSS and set the deployed URL before creating the build. Each installation generates and retains its own device ID. Rebuild the app after changing environment variables or native background-location configuration.

The data path is:

```text
Partner phone background GPS
  -> authenticated HTTPS POST /locations
  -> latest position stored in Redis
  -> Redis pub/sub and WebSocket broadcast /partners
  -> moving marker on every connected partner phone
```

When a user opens external directions, the phone registers for Expo push notifications and the server watches that partner's movement from the handed-off destination. After the partner moves 152.4 meters (500 feet), with a one-minute alert cooldown, the server sends an alert. Tapping it opens PoliceNav briefly, fetches the latest server position, and reopens Apple Maps or Google Maps with the refreshed destination. Configure `MOVEMENT_ALERT_METERS` and `ALERT_COOLDOWN_MS` on the server to tune those values.

Each officer can edit their current unit number, call sign, and optional second rider from the dashboard. Units support one or two displayed occupants. Status can be set to clear, traffic stop, cover requested, or pursuit. Traffic stops use yellow, cover requests use red, and pursuit status opens the driver's full-screen location display while presenting a restrained red/blue pulse to partners. A transition into cover-requested status sends a high-priority push with SquadNav's distinct cover-alarm sound to registered devices belonging to the requesting officer's squad partners, excluding the requesting device. Tapping the alert opens directions to the requesting officer's latest server location. A new native/TestFlight build is required whenever the bundled sound changes. iOS does not permit an app to launch Maps without user interaction while another app is active or the phone is locked, and ordinary notifications cannot override silent mode without Apple's restricted Critical Alerts entitlement.

Push alerts require a physical device and a new EAS development/TestFlight build with valid Apple push credentials. They do not work as remote push alerts in the iOS Simulator. Expo and APNs provide best-effort delivery rather than an emergency-service SLA, so the live in-app position and dispatch procedures remain the authoritative fallback.

PostgreSQL persists department data and Redis uses append-only persistence for recent live state, so restarting the Node server does not clear them. Live partner positions expire after 24 hours and navigation watches after four hours. A production deployment still needs managed backups, monitoring, structured authorization, retention controls, and agency review.

## Native development builds

Expo Go remains useful for the foreground UI, but background tracking requires a development or TestFlight build:

```bash
npx expo run:ios
npx expo run:android
```

Those commands generate the native `ios/` or `android/` folder locally, install the debug app, and start Expo. Rebuild after native dependency or app-configuration changes.

## Permissions

The app asks for foreground location permission at startup. The iOS permission text is configured in `app.json`; Android permissions are supplied by the `expo-location` config plugin. Select precise/high-accuracy location when the OS offers that choice.

Background permission is requested only after the user taps **START** under Partner Sharing. On iOS, choose **Always Allow**. If **Allow Once** was selected earlier, iOS may require changing the permission manually under Settings. Force-quitting the app can stop background updates; OS delivery frequency is never guaranteed.

If permission is denied, enable location for SquadNav in the device's Settings and reload the app.

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

`src/services/partnerService.js` connects to the live WebSocket when a backend URL is configured. Without a backend—or before squad partners have shared—the partner list remains empty. It reconnects automatically and retains the last good snapshot during brief interruptions.

Partner presence is based on both a backend-reported connection state and heartbeat freshness. A partner is treated as offline when no heartbeat has arrived for 45 seconds, even if the last message claimed the device was online. Signal quality (`good` or `weak`) should eventually come from the partner device/backend; it must not be inferred solely from GPS accuracy.

## Denton County GIS

`src/services/dentonCountyService.js` queries Denton County's public ArcGIS services for nearby 911 address points, road centerlines, and highway reference markers. GPS coordinates and direction remain fully local and update independently, so a slow or unavailable GIS response cannot stop the live location display. Outside Denton County—or whenever the county service is unavailable—the app falls back to the device reverse geocoder.

The displayed highway value is the nearest official reference-marker post, not an interpolated exact milepoint. The app displays its straight-line distance and source to avoid presenting an estimate as an exact location. Public GIS availability and accuracy are not guaranteed; operational deployment should use an agency-approved data agreement, cached data, monitoring, and a controlled backend.

Before using partner location operationally, add freshness indicators, stale/offline handling, server timestamps, accuracy radii, authorization checks, encrypted transport, audit controls, retention rules, and an explicit agency privacy/security review.

## Roadmap

1. **Real-time partner sharing** — replace the temporary shared pilot credential with agency authentication; add team authorization and explicit shift/session membership.
2. **Backend deployment** — move the local PostgreSQL/Redis stack to managed services; add validated schemas, backups, rate limits, monitoring, and audit controls.
3. **Authentication and authorization** — agency identity provider, short-lived tokens, team membership, device enrollment, remote revocation, and least-privilege access.
4. **Background location** — field-test battery tuning and OS delivery behavior; complete store-policy disclosures and agency privacy review.
5. **Map handoff** — add Waze, route modes, and additional graceful fallbacks. Apple Maps/Google Maps preference and stale-location confirmation are included.
6. **Authoritative blocks** — evaluate municipal GIS/address-range data rather than relying solely on reverse-geocoder street numbers.
7. **Operational hardening** — tests, accessibility review, secure telemetry, threat modeling, incident response, data minimization, and field trials.

## Useful files

- `src/hooks/useLiveLocation.js` — foreground location, heading, and throttled reverse geocoding
- `src/utils/direction.js` — course/heading selection and compass labels
- `src/utils/address.js` — address formatting and hundred-block derivation
- `src/services/partnerService.js` — live WebSocket partner subscription
- `src/services/navigationService.js` — native maps handoff
- `src/tasks/backgroundLocationTask.js` — global background GPS task
- `src/services/locationApi.js` — authenticated location upload and WebSocket configuration
- `backend/src/server.js` — HTTP/WebSocket location relay
- `backend/src/storage.js` — PostgreSQL and Redis data access
- `backend/db/schema.sql` — durable department/squad database schema
- `compose.yaml` — local PostgreSQL and Redis services

## Notes

- GPS course is only selected when reported speed is at least 1.5 m/s (about 3.4 mph); below that, the display uses compass heading.
- `timeInterval` applies to Android. iOS decides update timing based on the requested accuracy and distance filter.
- Continuous navigation-grade accuracy increases battery use.
- No officer identities, call signs, units, or partner coordinates are bundled with the app.
