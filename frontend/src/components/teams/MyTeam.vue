<template>
  <fitted-card icon="mdi-account-supervisor" icon-color="white" highlight-color="secondary">
    <template #title>
      {{ $t('page.team.card.myteam.title') }}
    </template>
    <template #content>
      <template v-if="localUserTeam == null">
        <v-row align="center" no-gutters>
          <v-col cols="12">
            {{ $t('page.team.card.myteam.no_team') }}
          </v-col>
        </v-row>
      </template>
      <template v-else>
        <v-container>
          <v-row>
            <v-col>
              <!-- Show the Team's invite URL -->
              <v-text-field
                v-model="displayName"
                variant="outlined"
                :label="$t('page.team.card.myteam.display_name_label')"
                hide-details="auto"
                maxlength="25"
                counter
              ></v-text-field>
            </v-col>
            <v-col cols="auto">
              <!-- Button to copy the invite URL to clipboard -->
              <v-btn variant="outlined" class="mx-1" style="height: 100%" @click="clearDisplayName">
                <v-icon>mdi-backspace</v-icon>
              </v-btn>
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <!-- Show the Team's invite URL -->
              <v-text-field
                v-model="visibleUrl"
                variant="outlined"
                :label="$t('page.team.card.myteam.team_invite_url_label')"
                hide-details="auto"
                readonly
              ></v-text-field>
            </v-col>
            <v-col cols="auto">
              <!-- Button to copy the invite URL to clipboard -->
              <v-btn variant="outlined" class="mx-1" style="height: 100%" @click="copyUrl">
                <v-icon>mdi-content-copy</v-icon>
              </v-btn>
            </v-col>
          </v-row>
        </v-container>
      </template>
    </template>
    <template #footer>
      <v-container class="">
        <v-row align="end" justify="start">
          <!-- Button to show the new token form -->
          <v-btn
            v-if="localUserTeam == null"
            :disabled="creatingTeam"
            :loading="creatingTeam"
            variant="outlined"
            class="mx-1"
            prepend-icon="mdi-account-group"
            @click="createTeam"
          >
            {{ $t('page.team.card.myteam.create_new_team') }}
          </v-btn>
          <v-btn
            v-if="localUserTeam != null"
            :disabled="leavingTeam"
            :loading="leavingTeam"
            variant="outlined"
            class="mx-1"
            prepend-icon="mdi-account-off"
            @click="leaveTeam"
          >
            {{
              isTeamOwner
                ? $t('page.team.card.myteam.disband_team')
                : $t('page.team.card.myteam.leave_team')
            }}
          </v-btn>
        </v-row>
      </v-container>
    </template>
  </fitted-card>
  <v-snackbar v-model="createTeamSnackbar" :timeout="4000" color="accent">
    {{ createTeamResult }}
    <template #actions>
      <v-btn color="white" variant="text" @click="createTeamSnackbar = false"> Close </v-btn>
    </template>
  </v-snackbar>
  <v-snackbar v-model="leaveTeamSnackbar" :timeout="4000" color="accent">
    {{ leaveTeamResult }}
    <template #actions>
      <v-btn color="white" variant="text" @click="leaveTeamSnackbar = false"> Close </v-btn>
    </template>
  </v-snackbar>
</template>
<script setup>
  import { ref, computed, watch, nextTick } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { fireuser, auth, functions, httpsCallable } from '@/plugins/firebase';
  import { useLiveData } from '@/composables/livedata';
  import { useUserStore } from '@/stores/user';
  import { useTarkovStore } from '@/stores/tarkov';
  import FittedCard from '@/components/ui/FittedCard';
  const { t } = useI18n({ useScope: 'global' });
  const { useTeamStore, useSystemStore } = useLiveData();
  const { teamStore } = useTeamStore();
  const { systemStore } = useSystemStore();
  const generateRandomName = (length = 6) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  };
  const localUserTeam = computed(() => {
    return systemStore.$state?.team || null;
  });
  const isTeamOwner = computed(() => {
    return teamStore.$state.owner === fireuser.uid && systemStore.$state?.team != null;
  });
  // Create new team
  const creatingTeam = ref(false);
  const createTeamResult = ref(null);
  const createTeamSnackbar = ref(false);
  const createTeam = async () => {
    creatingTeam.value = true;
    // Check if our reactive state indicates a logged-in user
    if (!fireuser.loggedIn || !fireuser.uid) {
      console.error('[MyTeam.vue] createTeam - User not authenticated (reactive state).');
      createTeamResult.value = t('page.team.card.myteam.user_not_authenticated');
      createTeamSnackbar.value = true;
      creatingTeam.value = false;
      return;
    }
    // Get the current Firebase user object directly from auth
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error(
        '[MyTeam.vue] createTeam - Firebase auth.currentUser is null, ' +
          'despite reactive state indicating login.'
      );
      createTeamResult.value = t('page.team.card.myteam.auth_inconsistency');
      // Add a new translation key for this
      createTeamSnackbar.value = true;
      creatingTeam.value = false;
      return;
    }
    try {
      const createTeamFunction = httpsCallable(functions, 'createTeam');
      const response = await createTeamFunction({
        // Add password, maximumMembers, etc. here if needed
      });
      // Firebase httpsCallable returns data in response.data
      const result = response.data;
      // Check for the team field under result.team
      if (!result || !result.team) {
        createTeamResult.value = t('page.team.card.myteam.create_team_error_ui_update');
        createTeamSnackbar.value = true;
        return;
      }
      await new Promise((resolve, _reject) => {
        const timeout = setTimeout(() => {
          console.warn(
            '[MyTeam] Timeout (15s) waiting for systemStore.$state.team to become non-null.'
          );
          _reject(new Error('Timed out waiting for system record to update with new team ID.'));
        }, 15000);
        let stopWatchingSystemTeam;
        stopWatchingSystemTeam = watch(
          () => systemStore.$state.team,
          (newTeamId) => {
            if (newTeamId != null) {
              clearTimeout(timeout);
              if (stopWatchingSystemTeam) {
                stopWatchingSystemTeam();
              }
              resolve(newTeamId);
            }
          },
          { immediate: true, deep: false }
        );
      });
      // Now wait for teamStore to be populated with the owner information for the new team
      await new Promise((resolve, _reject) => {
        const timeout = setTimeout(() => {
          console.warn(
            '[MyTeam] Timeout (15s) waiting for teamStore.owner to match fireuser.uid ' +
              'and password to be populated. Current teamStore.$state.owner:',
            teamStore.owner, // Log current owner at timeout
            'Current teamStore.$state.password:',
            teamStore.$state.password // Log current password at timeout
          );
          resolve(null); // Resolve with null on timeout as before, or consider rejecting
        }, 15000);
        let stopWatchingTeamOwnerAndPassword;
        stopWatchingTeamOwnerAndPassword = watch(
          () => teamStore.$state, // Watch the entire $state object
          (newState) => {
            const newOwner = newState?.owner;
            const newPassword = newState?.password; // Check for password
            // We need both owner to match and password to be populated
            if (newOwner && fireuser.uid && newOwner === fireuser.uid && newPassword) {
              clearTimeout(timeout);
              if (stopWatchingTeamOwnerAndPassword) {
                stopWatchingTeamOwnerAndPassword();
              }
              resolve(newState); // Resolve with the new state containing owner and password
            }
          },
          { immediate: true, deep: true } // Use deep: true for watching object properties
        );
      });
      await nextTick();
      if (localUserTeam.value) {
        createTeamResult.value = t('page.team.card.myteam.create_team_success');
        createTeamSnackbar.value = true;
        if (isTeamOwner.value) {
          const randomTeamName = generateRandomName();
          tarkovStore.setDisplayName(randomTeamName);
        } else {
          console.warn(
            "[MyTeam.vue] Team created and user is in team, but 'isTeamOwner' is still false. " +
              'This might indicate an issue with owner state propagation or comparison.'
          );
        }
      } else {
        console.error(
          '[MyTeam.vue] Team creation failed: UI state (localUserTeam) did not update ' +
            'after nextTick. $state.team:',
          systemStore.$state.team
        );
        createTeamResult.value = t('page.team.card.myteam.create_team_error_ui_update');
        createTeamSnackbar.value = true;
      }
    } catch (error) {
      // Log the full error object for inspection
      console.error('[MyTeam.vue] Error in createTeam function. Full error object below:');
      console.dir(error);
      console.error(
        '[MyTeam.vue] ERROR OBJECT (stringified, ' + "'in case dir is not showing full details):'"
      );
      try {
        console.log(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch {
        console.error('[MyTeam.vue] Could not stringify the error object');
      }
      let messageForSnackbar = null;
      if (error && typeof error === 'object') {
        if (error.details) {
          if (typeof error.details.error === 'string') {
            messageForSnackbar = error.details.error;
          } else if (typeof error.details === 'string') {
            // Attempt to parse if details is a string (might be stringified JSON)
            try {
              const parsedDetails = JSON.parse(error.details);
              if (parsedDetails && typeof parsedDetails.error === 'string') {
                messageForSnackbar = parsedDetails.error;
              } else {
                messageForSnackbar = error.details;
              }
            } catch {
              // Parsing failed, use error.details as is if it's a string
              messageForSnackbar = error.details;
            }
          }
        }
        // If no message from .details, fallback to error.message
        if (!messageForSnackbar && typeof error.message === 'string' && error.message.length > 0) {
          messageForSnackbar = error.message;
        }
      }
      // Ultimate fallback if no message could be extracted
      if (!messageForSnackbar) {
        messageForSnackbar = t('page.team.card.myteam.create_team_error');
      }
      createTeamResult.value = messageForSnackbar;
      createTeamSnackbar.value = true;
    }
    creatingTeam.value = false;
  };
  // Leave team
  const leavingTeam = ref(false);
  const leaveTeamResult = ref(null);
  const leaveTeamSnackbar = ref(false);
  const leaveTeam = async () => {
    leavingTeam.value = true;
    // Check if our reactive state indicates a logged-in user
    if (!fireuser.loggedIn || !fireuser.uid) {
      console.error('[MyTeam.vue] leaveTeam - User not authenticated (reactive state).');
      leaveTeamResult.value = t('page.team.card.myteam.user_not_authenticated');
      // Use existing or new translation key
      leaveTeamSnackbar.value = true;
      leavingTeam.value = false;
      return;
    }
    // Get the current Firebase user object directly from auth
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error(
        '[MyTeam] leaveTeam - Firebase auth.currentUser is null, ' +
          'despite reactive state indicating login.'
      );
      leaveTeamResult.value = t('page.team.card.myteam.auth_inconsistency');
      leaveTeamSnackbar.value = true;
      leavingTeam.value = false;
      return;
    }
    try {
      const leaveTeamFunction = httpsCallable(functions, 'leaveTeam');
      const response = await leaveTeamFunction({});
      const result = response.data;
      
      // Check if the operation was successful
      if (!result || (!result.left && systemStore.$state.team)) {
        leaveTeamResult.value = t('page.team.card.myteam.leave_team_error');
        leaveTeamSnackbar.value = true;
        return;
      }
      leaveTeamResult.value = t('page.team.card.myteam.leave_team_success');
      leaveTeamSnackbar.value = true;
      // Reset the local display name as the user is no longer in a team
      // This check ensures we only reset if they had a team-specific name
      if (tarkovStore.displayName.startsWith('User ')) {
        tarkovStore.setDisplayName(tarkovStore.getDefaultDisplayName());
      }
    } catch (error) {
      console.error('[MyTeam] Error leaving team:', error);
      leaveTeamResult.value =
        error.message || t('page.team.card.myteam.leave_team_error_unexpected');
      leaveTeamSnackbar.value = true;
    }
    leavingTeam.value = false;
  };
  const copyUrl = () => {
    if (teamUrl.value) {
      navigator.clipboard.writeText(teamUrl.value);
    } else {
      console.error('No team URL to copy');
    }
  };
  const teamUrl = computed(() => {
    const teamIdForUrl = systemStore.$state.team;
    const passwordForUrl = teamStore.$state.password;
    if (teamIdForUrl && passwordForUrl) {
      const baseUrl = window.location.href.split('?')[0];
      const teamParam = `team=${encodeURIComponent(teamIdForUrl)}`;
      const codeParam = `code=${encodeURIComponent(passwordForUrl)}`;
      return `${baseUrl}?${teamParam}&${codeParam}`;
    } else {
      return '';
    }
  });
  const userStore = useUserStore();
  const visibleUrl = computed(() => {
    if (userStore.getStreamerMode) {
      return t('page.team.card.myteam.url_hidden');
    } else {
      return teamUrl.value;
    }
  });
  const tarkovStore = useTarkovStore();
  // If the user changes their tarkov display name, we need to update it in the team store
  watch(
    () => tarkovStore.getDisplayName,
    (newDisplayName) => {
      if (isTeamOwner.value && newDisplayName !== teamStore.getOwnerDisplayName) {
        teamStore.setOwnerDisplayName(newDisplayName);
      }
    }
  );
  const displayName = computed({
    get() {
      // Directly access the state property
      const nameFromStore = tarkovStore.displayName;
      
      // Use fallback if nameFromStore is null, undefined, or empty string
      return nameFromStore || fireuser.uid?.substring(0, 6) || 'ErrorName';
    },
    set(newName) {
      if (newName !== '') {
        tarkovStore.setDisplayName(newName);
      }
    },
  });
  const clearDisplayName = () => {
    tarkovStore.setDisplayName(null);
  };
</script>
<style lang="scss" scoped></style>
