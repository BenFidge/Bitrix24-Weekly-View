# BX24 JS SDK (Local apps / iframe) — Copilot Technical Notes

Docs hub: https://apidocs.bitrix24.com/sdk/bx24-js-sdk/index.html

## Load SDK in iframe apps
Most local apps get `BX24` injected by Bitrix (in the iframe).
If you need to ensure it’s available, keep your init async-safe.

## Core REST call pattern
```ts
// call any REST method
BX24.callMethod("booking.v1.booking.list", { filter: {}, start: 0 }, (result: any) => {
  if (result.error()) {
    console.error(result.error());
    return;
  }
  const data = result.data();
  const more = result.more(); // pagination flag (if supported)
});
```

## Promise wrapper (recommended for TS projects)
```ts
export function bx24Call<T = any>(method: string, params: any = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    BX24.callMethod(method, params, (res: any) => {
      if (res.error()) return reject(res.error());
      resolve(res.data() as T);
    });
  });
}
```

## Batch calls (when supported)
```ts
// BX24.callBatch(requests, cb)
// requests: { [key: string]: [method, params] }
BX24.callBatch(
  {
    resources: ["booking.v1.resource.list", { filter: {}, start: 0 }],
    types: ["booking.v1.resourceType.list", { filter: {}, start: 0 }],
  },
  (result: any) => {
    // result.resources.data(), result.types.data()
  }
);
```

## Open internal UI (app/page helpers)
`BX24.openApplication` opens another app/page with params.
```ts
BX24.openApplication({ SOME: "PARAM" }, (res: any) => {
  // optional callback
});
```

## Resize iframe / fit content
```ts
BX24.resizeWindow(1200, 800);
BX24.fitWindow();
```

## Pull portal context
```ts
const userId = BX24.getAuth().member_id; // or BX24.getAuth() fields
BX24.callMethod("profile", {}, (r: any) => console.log(r.data()));
```

## Router / URL patterns commonly used
Bitrix often uses query flags for sliders / iframes:
- `IFRAME=Y`
- `IFRAME_TYPE=SIDE_SLIDER`
(These flags appear across Bitrix UI integrations; keep your own canonical helper.)

## Suggested local helpers (drop-in)
```ts
export function withSliderFlags(url: string) {
  const u = new URL(url, window.location.origin);
  u.searchParams.set("IFRAME", "Y");
  u.searchParams.set("IFRAME_TYPE", "SIDE_SLIDER");
  return u.toString();
}
```
