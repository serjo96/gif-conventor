import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: '/api',
  maxFileSize: 50 * 1024 * 1024, // 50MB
}; 