import "./assets/b24ui.css"; // Tailwind + B24UI styles (bundled, no CORS)

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

// Bitrix24 UI (Vue) plugin: registers B24* components + provides theme tokens
import b24UiPlugin from "@bitrix24/b24ui-nuxt/vue-plugin";

// Keep only minimal, layout-focused overrides after B24UI
import "./styles/weekly-view.css";
import "./styles/booking-form.css";
import "./styles/side-slider.css";

// Optional debug hooks so you can call services from DevTools console:
//   __b24.bookingService.getWeeklyBookings(...)
import { bitrix24Api } from "./services/bitrix24Api";
import { bookingService } from "./services/bookingService";
import { resourceService } from "./services/resourceService";

const qs = new URLSearchParams(window.location.search);
const isSideSlider =
  qs.get("IFRAME_TYPE") === "SIDE_SLIDER" ||
  qs.get("IFRAME") === "Y";

if (isSideSlider) {
  document.documentElement.classList.add("b24-side-slider");
  document.body.classList.add("b24-side-slider");
}


const app = createApp(App);

app.use(b24UiPlugin);
app.use(router);

app.mount("#app");

(window as any).__b24 = { bitrix24Api, bookingService, resourceService };
