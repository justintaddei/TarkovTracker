// Re-export the new modular composables for backward compatibility
export { useSystemStoreWithFirebase as useSystemStore } from '@/composables/stores/useSystemStore';
export { useTeamStoreWithFirebase as useTeamStore, useTeammateStores } from '@/composables/stores/useTeamStore';
export { useProgressStore } from '@/composables/stores/useProgressStore';
import { useTeammateStores } from '@/composables/stores/useTeamStore';
import type { Ref } from 'vue';
import type { Store } from 'pinia';
import type { UserState } from '@/shared_state';

// Legacy support - the actual implementation is now in the modular composables
// This maintains backward compatibility while using the new structure

// Moved to @/composables/utils/storeHelpers.ts as clearStaleState

// Moved to @/composables/firebase/useFirebaseListener.ts

// Team and system store implementations moved to modular composables

// Global state for backward compatibility
let globalTeammateStores: any = null;

// Function to initialize global state when called from setup
function initializeGlobalState() {
  if (!globalTeammateStores) {
    const { teammateStores } = useTeammateStores();
    globalTeammateStores = teammateStores;
  }
}

// Export for backward compatibility
export const teammateStores = globalTeammateStores;

// Get Tarkov store for backward compatibility - will be initialized in useLiveData
let tarkovStore: any = null;
const getTarkovStore = () => {
  if (!tarkovStore) {
    const { useTarkovStore } = require('@/stores/tarkov');
    tarkovStore = useTarkovStore();
  }
  return tarkovStore;
};

/**
 * Main composable that provides backward compatibility
 * while using the new modular structure under the hood
 */
export function useLiveData() {
  // Initialize global state when called from a setup function
  initializeGlobalState();
  
  // Import the composables dynamically to avoid issues
  const { useSystemStoreWithFirebase } = require('@/composables/stores/useSystemStore');
  const { useTeamStoreWithFirebase } = require('@/composables/stores/useTeamStore');
  const { useProgressStore } = require('@/composables/stores/useProgressStore');
  
  return {
    useTeamStore: useTeamStoreWithFirebase,
    useSystemStore: useSystemStoreWithFirebase,
    useProgressStore,
    teammateStores: globalTeammateStores,
    tarkovStore: getTarkovStore(),
  };
}
