# SidePanel / Slider (BX.SidePanel) — Copilot Technical Notes

Core docs (Bitrix): https://dev.1c-bitrix.ru/api_help/js_lib/sidepanel/sidepanel_instance.php

## Open slider
```ts
// global BX object is available inside Bitrix pages
BX.SidePanel.Instance.open("https://example.com/path?IFRAME=Y", {
  width: 900,            // number | string
  cacheable: false,      // boolean
  allowChangeHistory: true,
  allowChangeTitle: true,
  label: { text: "Booking", color: "#3bc8f5", bgColor: "#e5f6ff" },
  events: {
    onLoad: (event: any) => {},
    onClose: (event: any) => {},
    onCloseComplete: (event: any) => {},
  },
});
```

## Close slider (from inside)
```ts
BX.SidePanel.Instance.close();
```

## Messaging between slider + parent
Patterns vary by app; keep your canonical window messaging helper:
```ts
// parent
window.addEventListener("message", (e) => {
  if (e.data?.type === "booking:saved") {
    // refresh grid
  }
});

// inside slider
window.parent.postMessage({ type: "booking:saved", payload: { id: 123 } }, "*");
```

## Recommended local wrapper (type-friendly)
```ts
export type SidePanelOpenOptions = {
  width?: number | string;
  cacheable?: boolean;
  allowChangeHistory?: boolean;
  allowChangeTitle?: boolean;
  label?: { text?: string; color?: string; bgColor?: string };
  events?: Record<string, Function>;
};

export function openSlider(url: string, options: SidePanelOpenOptions = {}) {
  BX.SidePanel.Instance.open(url, options as any);
}
```
