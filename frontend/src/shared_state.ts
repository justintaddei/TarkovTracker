import type { _GettersTree } from 'pinia';

// State interfaces
interface TaskObjective {
  count?: number;
  complete?: boolean;
  timestamp?: number;
}

interface TaskCompletion {
  complete?: boolean;
  failed?: boolean;
  timestamp?: number;
}

interface HideoutPart {
  count?: number;
  complete?: boolean;
  timestamp?: number;
}

interface HideoutModule {
  complete?: boolean;
  timestamp?: number;
}

export interface UserState {
  level: number;
  gameEdition: number;
  pmcFaction: 'USEC' | 'BEAR';
  displayName: string | null;
  taskObjectives: { [objectiveId: string]: TaskObjective };
  taskCompletions: { [taskId: string]: TaskCompletion };
  hideoutParts: { [objectiveId: string]: HideoutPart };
  hideoutModules: { [hideoutId: string]: HideoutModule };
}

export const defaultState: UserState = {
  level: 1,
  gameEdition: 1,
  pmcFaction: 'USEC',
  displayName: null,
  taskObjectives: {},
  taskCompletions: {},
  hideoutParts: {},
  hideoutModules: {},
};

// Simplified getters using arrow functions
export const getters = {
  playerLevel: (state: UserState) => () => state.level ?? 1,

  getGameEdition: (state: UserState) => () => state.gameEdition ?? 1,

  getPMCFaction: (state: UserState) => () => state.pmcFaction ?? 'USEC',

  getDisplayName: (state: UserState) => () =>
    state.displayName === '' ? null : (state.displayName ?? null),

  getObjectiveCount: (state: UserState) => (objectiveId: string) =>
    state?.taskObjectives?.[objectiveId]?.count ?? 0,

  getHideoutPartCount: (state: UserState) => (objectiveId: string) =>
    state?.hideoutParts?.[objectiveId]?.count ?? 0,

  isTaskComplete: (state: UserState) => (taskId: string) =>
    state?.taskCompletions?.[taskId]?.complete ?? false,

  isTaskFailed: (state: UserState) => (taskId: string) =>
    state?.taskCompletions?.[taskId]?.failed ?? false,

  isTaskObjectiveComplete: (state: UserState) => (objectiveId: string) =>
    state?.taskObjectives?.[objectiveId]?.complete ?? false,

  isHideoutPartComplete: (state: UserState) => (objectiveId: string) =>
    state?.hideoutParts?.[objectiveId]?.complete ?? false,

  isHideoutModuleComplete: (state: UserState) => (hideoutId: string) =>
    state?.hideoutModules?.[hideoutId]?.complete ?? false,
} as const satisfies _GettersTree<UserState>;

// Helper functions for common operations
const createCompletion = (complete: boolean, failed = false) => ({
  complete,
  failed,
  timestamp: Date.now(),
});

const updateObjective = (
  state: UserState,
  key: keyof UserState,
  objectiveId: string,
  updates: Record<string, unknown>
) => {
  const stateValue = state[key];
  if (!stateValue || typeof stateValue !== 'object') {
    (state[key] as Record<string, unknown>) = {};
  }
  const stateObj = state[key] as Record<string, unknown>;
  stateObj[objectiveId] = {
    ...(stateObj[objectiveId] || {}),
    ...updates,
  };
};

// Simplified actions
export const actions = {
  incrementLevel(this: UserState) {
    this.level = this.level ? this.level + 1 : 2;
  },

  decrementLevel(this: UserState) {
    this.level = Math.max(1, (this.level || 1) - 1);
  },

  setLevel(this: UserState, level: number) {
    this.level = Math.max(1, level);
  },

  setGameEdition(this: UserState, edition: number) {
    this.gameEdition = edition;
  },

  setPMCFaction(this: UserState, faction: 'USEC' | 'BEAR') {
    this.pmcFaction = faction;
  },

  setDisplayName(this: UserState, name: string | null) {
    this.displayName = typeof name === 'string' ? name : null;
  },

  setObjectiveCount(this: UserState, objectiveId: string, count: number) {
    updateObjective(this, 'taskObjectives', objectiveId, { count: Math.max(0, count) });
  },

  setHideoutPartCount(this: UserState, objectiveId: string, count: number) {
    updateObjective(this, 'hideoutParts', objectiveId, { count: Math.max(0, count) });
  },

  setTaskComplete(this: UserState, taskId: string) {
    updateObjective(this, 'taskCompletions', taskId, createCompletion(true, false));
  },

  setTaskFailed(this: UserState, taskId: string) {
    updateObjective(this, 'taskCompletions', taskId, createCompletion(true, true));
  },

  setTaskUncompleted(this: UserState, taskId: string) {
    updateObjective(this, 'taskCompletions', taskId, createCompletion(false, false));
  },

  setTaskObjectiveComplete(this: UserState, objectiveId: string) {
    updateObjective(this, 'taskObjectives', objectiveId, { complete: true, timestamp: Date.now() });
  },

  setTaskObjectiveUncomplete(this: UserState, objectiveId: string) {
    updateObjective(this, 'taskObjectives', objectiveId, { complete: false });
  },

  toggleTaskObjectiveComplete(this: UserState, objectiveId: string) {
    const isComplete = getters.isTaskObjectiveComplete(this)(objectiveId);
    if (isComplete) {
      actions.setTaskObjectiveUncomplete.call(this, objectiveId);
    } else {
      actions.setTaskObjectiveComplete.call(this, objectiveId);
    }
  },

  setHideoutPartComplete(this: UserState, objectiveId: string) {
    updateObjective(this, 'hideoutParts', objectiveId, { complete: true, timestamp: Date.now() });
  },

  setHideoutPartUncomplete(this: UserState, objectiveId: string) {
    updateObjective(this, 'hideoutParts', objectiveId, { complete: false });
  },

  toggleHideoutPartComplete(this: UserState, objectiveId: string) {
    const isComplete = getters.isHideoutPartComplete(this)(objectiveId);
    if (isComplete) {
      actions.setHideoutPartUncomplete.call(this, objectiveId);
    } else {
      actions.setHideoutPartComplete.call(this, objectiveId);
    }
  },

  setHideoutModuleComplete(this: UserState, hideoutId: string) {
    updateObjective(this, 'hideoutModules', hideoutId, { complete: true, timestamp: Date.now() });
  },

  setHideoutModuleUncomplete(this: UserState, hideoutId: string) {
    updateObjective(this, 'hideoutModules', hideoutId, { complete: false });
  },

  toggleHideoutModuleComplete(this: UserState, hideoutId: string) {
    const isComplete = getters.isHideoutModuleComplete(this)(hideoutId);
    if (isComplete) {
      actions.setHideoutModuleUncomplete.call(this, hideoutId);
    } else {
      actions.setHideoutModuleComplete.call(this, hideoutId);
    }
  },
} as const;

export type UserActions = typeof actions;
