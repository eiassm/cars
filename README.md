# Palestine Auto Expo 2027

Website and interactive 3D floor plan for the expo at the Ramallah Sports Village parking yard, 1–7 May 2027.

- `/ar`, `/en` — event website (Arabic is the default; `/` redirects to `/ar`)
- `/ar/ev`, `/en/ev` — interactive 3D plan, EV & plug-in edition (three.js); `/[lang]/floor-plan` redirects here

No database yet: the visit registration form only shows a confirmation on the device.

## Develop

```bash
npm install
npm run dev
```

## Notes

- Venue geometry, booths and zones live in `src/lib/expo.ts` (metres, from the 1:250 site plan — approximate until the scan and CAD drawing arrive).
- Copy for both languages lives in `src/lib/i18n.ts`.
- The 3D scene is `src/components/venue/scene.ts`.
- The car model in `public/models/car.glb` is a placeholder: CarConcept © Darmstadt Graphics Group, CC BY 4.0 (Khronos glTF sample assets), simplified and meshopt-compressed.
- The day sky is derived from Poly Haven's "kloofendal_48d_partly_cloudy_puresky" (CC0). Exhibitor photos are from Unsplash.
- Exhibitor names in `EXHIBITORS` are placeholders until the confirmed list arrives.
