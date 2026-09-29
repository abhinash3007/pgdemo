# My PG — owner demo

Frontend-only, mobile-first demo of the PG management app, for showing PG owners during visits.
No backend and no login. Data is kept in the browser (localStorage), so a refresh mid-demo keeps everything.

## Run locally

```
start-demo.bat
```

Or with Node on PATH: `npm install` then `npm run dev`. Vite prints a `Network:` URL; open it on a phone connected to the same Wi-Fi.

## Deploy as a link

`npm run build` creates `dist/`. The app uses hash URLs (`/#/rent`), so no rewrite rules are needed.

- **Netlify:** drag the `dist` folder onto app.netlify.com/drop, or `npx netlify deploy --prod --dir dist`.
- **Vercel:** `npx vercel --prod` (framework: Vite, output: `dist`).

On the phone, use "Add to Home screen" so it opens full screen like an app.

## Demo script (about 5 minutes)

1. **My PG:** floors, rooms and bed dots (green = empty, grey = occupied, orange = on notice). Tap "Empty beds" to see only vacancies.
2. **Tap a room**, then an empty bed, then **Add tenant**. Enter name and phone, then save. The bed turns occupied, and the WhatsApp document link is shown.
3. Tap the link in the WhatsApp preview to see the **tenant's upload page** (consent, then upload).
4. **Rent tab:** overdue, due soon and paid. Tap **Mark paid**, then Half and UPI, to show a part payment. Tap **Send receipt** in the toast.
5. **WhatsApp tab:** the tenant's reminder has an "I've paid" button. Tap it, switch to **You get**, and confirm the payment.
6. **Enter their PG:** go to ⋯, then **Set up a new PG**, and add their floors and rooms on the spot.
7. When you're done, go to ⋯ and tap **Reset demo data**.

## Code layout

```
src/services/api.js       single data-access layer used by every screen (swap internals for Spring Boot API calls later)
src/services/logic.js     business rules: rent dues, due dates, bed status, sharing changes
src/services/store.js     in-memory copy + localStorage persistence
src/services/sampleData.js  sample PG, generated relative to today's date
src/screens/              Home, AddTenant, TenantProfile, Rent, Tenants, WhatsApp, TenantUpload
src/components/           UI kit, bottom sheet, toasts, Mark-paid sheet
```

Rules worth knowing:
- Rent is due every month on the move-in day. "Due soon" means within 7 days.
- Move-out closes the stay and never deletes it, so history is kept. Beds or rooms with history are archived, not deleted.
- Reducing a room's sharing only removes empty beds.
- Payments are records (cash, UPI or bank), partial payments are allowed, and tenant-reported payments wait for the owner to confirm.
- Documents are mocked: only file names are stored.
