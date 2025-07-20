<template>
  <div class="migration-steps mb-4">
    <div class="step-item">
      <span class="step-number">1</span>
      <span class="step-text">
        Go to
        <a href="https://tarkovtracker.io/settings" target="_blank" class="info-link">
          tarkovtracker.io/settings
        </a>
      </span>
    </div>
    <div class="step-item">
      <span class="step-number">2</span>
      <span class="step-text">Login if you're not already logged in</span>
    </div>
    <div class="step-item">
      <span class="step-number">3</span>
      <span class="step-text">Go to Settings > API Tokens</span>
    </div>
    <div class="step-item">
      <span class="step-number">4</span>
      <span class="step-text">Create a new token with "Get Progression" permission enabled</span>
    </div>
    <div class="step-item">
      <span class="step-number">5</span>
      <span class="step-text">Copy the token and paste it below</span>
    </div>
  </div>
</template>

<style scoped>
.migration-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  background-color: rgba(var(--v-theme-primary), 1);
  color: white;
  border-radius: 50%;
  font-size: 14px;
  font-weight: bold;
}

.step-text {
  padding-top: 2px;
  text-align: left;
}

.info-link {
  color: rgba(var(--v-theme-link), 1);
  text-decoration: none;
}

.info-link:hover {
  text-decoration: underline;
}
</style>