import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/css/main.css';
import './styles/weekly-view.css';
import './styles/booking-form.css';

// Optional debug hooks so you can call services from DevTools console:
//   __b24.bookingService.getWeeklyBookings(...)
// Remove when stable.
import { bitrix24Api } from './services/bitrix24Api';
import { bookingService } from './services/bookingService';
import { resourceService } from './services/resourceService';

const app = createApp(App);
app.use(router);
app.mount('#app');

(window as any).__b24 = {
    bitrix24Api,
    bookingService,
    resourceService
};
