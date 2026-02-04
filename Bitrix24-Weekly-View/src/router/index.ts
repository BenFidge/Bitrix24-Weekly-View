import { createRouter, createWebHashHistory } from 'vue-router';
import WeeklyView from '../views/WeeklyView.vue';
import BookingCreateView from '../views/BookingCreateView.vue';
import BookingEditView from '../views/BookingEditView.vue';

const routes = [
    {
        path: '/',
        name: 'weekly-view',
        component: WeeklyView
    },
    {
        path: '/booking-create',
        name: 'booking-create',
        component: BookingCreateView
    },
    {
        path: '/booking-edit',
        name: 'booking-edit',
        component: BookingEditView
    },
    {
        path: '/slot-finder',
        redirect: { name: 'booking-create' }
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
