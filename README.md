# KLG Delivery – Admin + Driver app (demo build)

React 18 + Vite 5 delivery app for Krishna Leela Grand, packaged for Android with Capacitor 6.
One app, two roles, chosen on the sign-in screen:

- **Admin** – Deliveries (list, details, assign/reassign driver, status updates, cancel), Drivers, Driver Performance, Settings.
- **Driver** – My Deliveries (call customer, open address in Google Maps, Picked up → Start delivery → Delivered,
  cash-to-collect for COD), History (today / 7 days / all, distance and cash totals), Profile (online/offline, log out).

## Run in the browser
```
npm install
npm run dev        # http://localhost:5173  (also on your LAN IP for phone testing)
```

## Build the Android APK
```
npm run build
npx cap sync android
cd android
gradlew.bat assembleDebug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk` (debug-signed, for testing/sideloading).
Requires JDK 17 and the Android SDK (`android/local.properties` points at it).
The Gradle wrapper uses Gradle 8.14.3 because downloading 8.2.1 timed out on this machine.

## Live mode (default)
`.env` → `VITE_USE_MOCK_DATA=false`. The app uses the same KLG backend as the website
(`VITE_API_BASE_URL`, Express on Cloud Functions, data in MongoDB). It never writes to Firestore.

- **Sign-in:** one form. Admin email + password, or a driver's 10-digit mobile number (or email) + password
  (`POST /admin/login`). The server decides the role. Admin roles allowed: Super Admin, Admin, Delivery.
- **Admin:** `/admin/orders?orderType=DELIVERY`, status changes (`PATCH /admin/orders/:id/<step>`),
  assign a driver or offer an order to all online drivers (`/assign-rider`), drivers CRUD (`/admin/riders`).
- **Driver:** offers + assigned orders, accept / decline → start (picked up) → complete (`/rider/orders/*`),
  online/offline (`/rider/status`), stats (`/rider/stats`), live GPS while out for delivery.
- **Refresh:** every `VITE_POLL_MS` (15 s) while open.
- **CORS:** the Android WebView origin (`https://localhost`) is not on the backend's allow-list, so
  `CapacitorHttp` is enabled in `capacitor.config.json`. Requests go through native HTTP with no Origin header.

## Notifications
- **Admin phones:** after sign-in the app registers its FCM token at `POST /public/device-tokens`. The backend's
  `NEW_ORDER` / `ORDER_RESOLVED` pushes ring the phone even when the app is closed (`KlgMessagingService.java`).
  This needs `android/app/google-services.json` for package `com.krishnaleelagrand.admin`:
  ```
  firebase apps:create ANDROID "KLG Delivery" --package-name com.krishnaleelagrand.admin --project krishna-leela-grand
  firebase apps:sdkconfig ANDROID <APP_ID printed above> --project krishna-leela-grand -o android/app/google-services.json
  ```
- **Driver phones:** these are not registered for push, because the backend sends every new order to every
  registered device. The app compares each refresh with the last one and rings for new assignments or offers,
  and alerts on cancellations. This works while the app is open or in the background, but not after Android
  closes the app. Push to a closed driver app needs a backend change that sends FCM to that rider's token.

## Demo mode
`VITE_USE_MOCK_DATA=true`. Data lives only in this browser's / phone's localStorage and nothing is sent to any server.
Sign-in is simulated: pick Admin, or Driver plus the driver's name. Reset data from Settings → Application → Reset demo data.

## Tests
```
npm test            # 25 tests: business rules + end-to-end screen flows against a simulated KLG backend
npm run test:live   # read-only checks against the real backend (never changes data)
npm run apk         # build web + sync + debug APK
```
`tests/fakeBackend.js` copies the real backend's routes and rules (status transitions, the driver accept rules,
BUSY/OFFLINE). The end-to-end test runs a full delivery: admin signs in → Accept Delivery → Dispatch → assign driver →
driver signs in → accept → picked up → cash collected → delivered.
To include sign-in in the live checks, set `KLG_ADMIN_EMAIL`, `KLG_ADMIN_PASSWORD`, `KLG_DRIVER_LOGIN` and `KLG_DRIVER_PASSWORD`.

## Delivery flow
| Stage | Delivery staff (admin) | Driver |
|---|---|---|
| New order (auto-accepts after 60 s) | **Accept Order** / Cancel | – |
| Preparing | **Parcel Ready**; can **Assign** a driver now | **Swipe to accept** the assignment/offer |
| Parcel ready | **Assign Driver** if nobody has it yet; **Handed to Driver** (backup) | **Swipe when picked up** (locked until parcel ready) |
| Picked up · on the way | **Mark Delivered** (backup) | **Swipe to mark delivered** (cash orders confirm the amount) |

Backend statuses: PENDING → PREPARING → PACKING → OUT_FOR_DELIVERY → DELIVERED.
