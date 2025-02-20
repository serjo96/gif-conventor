import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import { conversionQueue } from '../queues';
import config from './index';

const serverAdapter = new ExpressAdapter();

// Настраиваем базовый путь для админки
serverAdapter.setBasePath('/admin/queues');

// Создаем Bull Board с расширенными опциями
createBullBoard({
  queues: [new BullAdapter(conversionQueue, { allowRetries: true, readOnlyMode: false })],
  serverAdapter,
});

// Защита админки базовой аутентификацией
const basicAuthMiddleware = basicAuth({
  users: { [config.bullBoard.username]: config.bullBoard.password },
  challenge: true,
});

export { serverAdapter, basicAuthMiddleware }; 