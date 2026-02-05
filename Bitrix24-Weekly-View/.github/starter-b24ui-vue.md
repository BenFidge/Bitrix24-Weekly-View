# Starter Kit (starter-b24ui-vue) — Copilot Technical Notes

Repo: https://github.com/bitrix24/starter-b24ui-vue

## What to extract into local docs for Copilot
Document these *as used in your solution* (don’t try to document the whole repo):
- `main.ts` bootstrap order (plugins, router, store, UI Kit init)
- Where `BX24` is accessed (global typing shim)
- App mounting div id and index.html constraints for Bitrix static app
- Build output expectations (dist/index.html + assets/*)
- ZIP packaging rules for Bitrix upload (your existing script)

## Typical Bitrix local app layout (keep canonical)
```
/public
  manifest.json (if used)
  favicon.ico
/src
  /api        (BX24 wrappers, REST method wrappers)
  /ui         (re-exports for b24ui components)
  /views      (Weekly view, Booking edit view)
  /lib        (date, tz helpers)
index.html
vite.config.ts
package.json
```

## Global typing for BX/BX24 (TypeScript)
Create `src/types/bitrix.d.ts`:
```ts
declare const BX24: any;
declare const BX: any;
```

## Bitrix-safe init guard
```ts
export function waitForBx24(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (typeof (window as any).BX24 !== "undefined") {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("BX24 not available"));
      }
    }, 50);
  });
}
```

## REST wrapper folder suggestion
Keep method wrappers grouped by namespace:
```
src/api/booking.ts
src/api/calendar.ts
src/api/index.ts
```

Example `src/api/booking.ts`:
```ts
import { bx24Call } from "./bx24";

export const bookingApi = {
  listBookings: (filter: any, start = 0) =>
    bx24Call("booking.v1.booking.list", { filter, start }),

  addBooking: (fields: any) =>
    bx24Call("booking.v1.booking.add", { fields }),
};
```

## Slider open patterns (local app)
From weekly grid:
```ts
import { openSlider } from "../lib/sidepanel";

openSlider("/local/path/booking-edit?ID=123&IFRAME=Y", { width: 900, cacheable: false });
```
