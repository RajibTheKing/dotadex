import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * Hash history keeps deep links working on static hosts (and file:// previews)
 * without any server rewrite rules.
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: 'DotaDex' },
    },
    {
      path: '/suggest',
      name: 'suggest',
      component: () => import('@/views/SuggestView.vue'),
      meta: { title: 'Roll a hero' },
    },
    {
      path: '/dex',
      name: 'dex',
      component: () => import('@/views/DexView.vue'),
      meta: { title: 'The Dex' },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { title: 'Wall of Fame' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: { title: 'About' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? 'DotaDex'
  document.title = `${title} · DotaDex`
})

export default router
