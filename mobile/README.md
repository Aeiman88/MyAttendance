# MyAttendance phone app

The staff app for clocking in and out (Expo SDK 58, React Native). It talks to the MyAttendance server in the folder above.

```bash
npm install
npx expo start          # try it in Expo Go
npm run build:apk       # build the Android .apk with EAS (needs eas-cli and a free Expo account)
npm run typecheck
```

Set the server address in `eas.json` (`EXPO_PUBLIC_API_URL`) before building, or leave it empty and the app asks on first launch.

`src/shared/` holds copies of `../src/lib/time.ts`, `rules.ts` and `geo.ts`, so the app and the server work out late minutes, zones and day status the same way. After changing those files, run `npm run sync-shared`.

Full instructions: section 3 of `../README.md`.
