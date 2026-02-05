# UI Kit (b24ui) — Copilot Technical Notes

Repo: https://github.com/bitrix24/b24ui

## Install (typical)
```bash
npm i @bitrix24/b24ui
# or per starter kit instructions (pin versions)
```

## Import / bootstrap (pattern)
```ts
// main.ts
import { createApp } from "vue";
import App from "./App.vue";

// UI Kit init varies by template; keep this doc close to your starter kit usage.
import B24UI from "@bitrix24/b24ui";

createApp(App)
  .use(B24UI /*, options */)
  .mount("#app");
```

## Component usage pattern (typical)
```vue
<script setup lang="ts">
import { ref } from "vue";

const open = ref(false);
</script>

<template>
  <B24Button @click="open = true">Open</B24Button>

  <B24Modal v-model="open" title="Title">
    <div>Body</div>
  </B24Modal>
</template>
```

## “Native-ish” UI building blocks to document locally
Create local markdown for these (names vary by version; check your installed kit):
- Buttons / Icon buttons
- Inputs: text, select, checkbox, radio, textarea, date/time
- Layout: grid, flex helpers, cards, panels
- Feedback: loader/spinner, toast/notify, alert, badge, tooltip
- Overlays: modal, drawer, dropdown/popover
- Navigation: tabs, breadcrumbs, pagination

## Recommended local shim file (for your project)
Create `src/ui/index.ts` re-exports so Copilot learns your app’s canon:
```ts
// src/ui/index.ts
export { default as B24Button } from "@bitrix24/b24ui/components/Button.vue";
export { default as B24Modal } from "@bitrix24/b24ui/components/Modal.vue";
// ...re-export only what you actually use
```

## Version pinning note (Copilot context)
Put the exact versions in a doc (Copilot reads it):
```json
// package.json
{
  "dependencies": {
    "@bitrix24/b24ui": "x.y.z"
  }
}
```
