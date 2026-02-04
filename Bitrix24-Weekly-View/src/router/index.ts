import { createRouter, createWebHashHistory } from 'vue-router';
import WeeklyView from '../views/WeeklyView.vue';
import SlotFinderView from '../views/SlotFinderView.vue';

const routes = [
    {
        path: '/',
        name: 'weekly-view',
        component: WeeklyView
    },
    {
        path: '/slot-finder',
        name: 'slot-finder',
        component: SlotFinderView
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
