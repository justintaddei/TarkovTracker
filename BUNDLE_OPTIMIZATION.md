# Bundle Optimization Recommendations

Based on the build analysis showing large chunks (Firebase: 888KB, Vuetify: 339KB), here are specific recommendations to improve bundle performance:

## Critical Issues

- **Firebase bundle**: 888KB (208KB gzipped) - Largest dependency
- **Vuetify bundle**: 339KB (112KB gzipped) - Second largest
- **Build warning**: Chunks larger than 500KB after minification

## High-Priority Optimizations

### 1. Firebase Code Splitting

**Current Issue**: Firebase is loaded as a single large chunk
**Solution**: Split Firebase features into separate chunks

```typescript
// frontend/src/plugins/firebase-lazy.ts
export const loadFirebaseAuth = () => import('firebase/auth')
export const loadFirebaseFirestore = () => import('firebase/firestore')
export const loadFirebaseFunctions = () => import('firebase/functions')

// Usage in components
const authModule = await import('@/plugins/firebase-lazy')
const { getAuth } = await authModule.loadFirebaseAuth()
```

### 2. Vuetify Tree Shaking Optimization

**Current Issue**: Importing entire Vuetify library
**Solution**: Configure more aggressive tree shaking

```typescript
// frontend/vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vuetify-core': ['vuetify/lib'],
          'vuetify-components': ['vuetify/components'],
          'vuetify-directives': ['vuetify/directives']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['vuetify/components', 'vuetify/directives']
  }
})
```

### 3. Route-Based Code Splitting

**Current Issue**: All page components loaded upfront
**Solution**: Implement lazy loading for routes

```typescript
// frontend/src/router/routes.ts
const routes = [
  {
    path: '/tasks',
    component: () => import('@/pages/TaskList.vue')
  },
  {
    path: '/needed-items', 
    component: () => import('@/pages/NeededItems.vue')
  },
  {
    path: '/settings',
    component: () => import('@/pages/TrackerSettings.vue')
  }
]
```

### 4. Component-Level Code Splitting

**Current Issue**: Large components loaded synchronously
**Solution**: Use defineAsyncComponent for heavy components

```typescript
// Example implementation in TaskList.vue
import { defineAsyncComponent } from 'vue'

const TarkovMap = defineAsyncComponent(() => import('@/features/maps/TarkovMap.vue'))
const TaskCard = defineAsyncComponent(() => import('@/features/tasks/TaskCard.vue'))
const HideoutCard = defineAsyncComponent(() => import('@/features/hideout/HideoutCard.vue'))
```

## Medium-Priority Optimizations

### 5. Vendor Chunk Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-ui': ['vuetify'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-apollo': ['@apollo/client', 'graphql'],
          'vendor-utils': ['lodash-es', 'date-fns']
        }
      }
    }
  }
})
```

### 6. Dynamic Import for Heavy Features

```typescript
// For rarely used features like data migration
const loadDataMigration = async () => {
  const { DataMigrationService } = await import('@/utils/DataMigrationService')
  return new DataMigrationService()
}
```

### 7. Service Worker Implementation

```typescript
// frontend/src/sw.ts
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3
  })
)

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [{
      cacheKeyWillBeUsed: async ({ request }) => {
        return `${request.url}?v=1`
      }
    }]
  })
)
```

## Low-Priority Optimizations

### 8. Bundle Analysis Configuration

```json
// package.json
{
  "scripts": {
    "analyze": "vite build --mode analyze && npx vite-bundle-analyzer dist"
  }
}
```

### 9. Preload Critical Resources

```html
<!-- index.html -->
<link rel="modulepreload" href="/src/main.ts">
<link rel="modulepreload" href="/src/App.vue">
<link rel="preload" href="/fonts/materialdesignicons-webfont.woff2" as="font" type="font/woff2" crossorigin>
```

### 10. Compression Configuration

```typescript
// vite.config.ts
import { compression } from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    compression({
      algorithm: 'brotliCompress',
      ext: '.br'
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz'
    })
  ]
})
```

## Expected Performance Improvements

### Bundle Size Reductions
- **Firebase splitting**: ~40% reduction (888KB → ~530KB)
- **Vuetify optimization**: ~25% reduction (339KB → ~254KB)
- **Route splitting**: ~60% initial load reduction
- **Component splitting**: ~30% initial load reduction

### Performance Metrics
- **First Contentful Paint**: 2-3s → 1-1.5s
- **Largest Contentful Paint**: 4-5s → 2-3s
- **Time to Interactive**: 5-6s → 3-4s

## Implementation Priority

1. **Week 1**: Firebase code splitting (highest impact)
2. **Week 2**: Route-based lazy loading
3. **Week 3**: Component-level code splitting
4. **Week 4**: Vuetify tree shaking optimization
5. **Week 5**: Service worker implementation

## Monitoring

```typescript
// Performance monitoring
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'navigation') {
      console.log('Page Load Time:', entry.loadEventEnd - entry.loadEventStart)
    }
  }
})

observer.observe({ entryTypes: ['navigation', 'resource'] })
```

## Risk Assessment

- **Low Risk**: Route-based code splitting, component lazy loading
- **Medium Risk**: Firebase code splitting (test authentication flows thoroughly)
- **High Risk**: Vuetify tree shaking (may break component functionality)

Implement optimizations incrementally with thorough testing at each stage.