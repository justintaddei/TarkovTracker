/**
 * Deployment configuration for gradual rollout of new API architecture
 */

export interface DeploymentConfig {
  // Feature flags for gradual rollout
  useNewErrorHandling: boolean;
  useNewProgressService: boolean;
  useNewTeamService: boolean;
  useNewTokenService: boolean;
  
  // Monitoring and logging
  enableDetailedLogging: boolean;
  enablePerformanceMonitoring: boolean;
  
  // Rollback settings
  rollbackOnErrorRate: number; // Percentage threshold (e.g., 5 = 5%)
  rollbackOnResponseTime: number; // Response time threshold in ms
}

// Production deployment config - conservative rollout
export const PRODUCTION_CONFIG: DeploymentConfig = {
  useNewErrorHandling: true,
  useNewProgressService: true,
  useNewTeamService: true,
  useNewTokenService: true,
  enableDetailedLogging: false,
  enablePerformanceMonitoring: true,
  rollbackOnErrorRate: 5,
  rollbackOnResponseTime: 5000,
};

// Development/staging config - full new features
export const DEVELOPMENT_CONFIG: DeploymentConfig = {
  useNewErrorHandling: true,
  useNewProgressService: true,
  useNewTeamService: true,
  useNewTokenService: true,
  enableDetailedLogging: true,
  enablePerformanceMonitoring: true,
  rollbackOnErrorRate: 10,
  rollbackOnResponseTime: 10000,
};

// Get config based on environment
export function getDeploymentConfig(): DeploymentConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return PRODUCTION_CONFIG;
    case 'staging':
      return { ...DEVELOPMENT_CONFIG, enableDetailedLogging: false };
    default:
      return DEVELOPMENT_CONFIG;
  }
}

// Environment variables validation
export function validateEnvironment(): void {
  const required = [
    'GOOGLE_APPLICATION_CREDENTIALS', // Firebase admin SDK
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}