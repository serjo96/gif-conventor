import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  maxFileSize: 50 * 1024 * 1024, // 50MB
}; 