import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  corsOrigin: string | string[];
  redisUrl: string;
  baseUrl: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  bullBoard: {
    username: string;
    password: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4200', 'http://localhost:5173'],
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  bullBoard: {
    username: process.env.BULL_BOARD_USER || 'admin',
    password: process.env.BULL_BOARD_PASS || 'admin'
  },
};

export default config; 