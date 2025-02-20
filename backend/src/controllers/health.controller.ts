import { Request, Response } from 'express';
import { ApiResponse } from '../types/api.types';
import { conversionQueue } from '../queues';

export class HealthController {
  async ping(req: Request, res: Response) {
    const response: ApiResponse<{ status: string; redis: boolean }> = {
      success: true,
      data: {
        status: 'ok',
        redis: false
      }
    };

    try {
      const client = await conversionQueue.client;
      await client.ping();
      response.data.redis = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    res.json(response);
  }
}
