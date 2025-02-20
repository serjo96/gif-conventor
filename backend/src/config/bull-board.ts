import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import { conversionQueue } from '../queues';
import config from './index';

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(conversionQueue, { allowRetries: true, readOnlyMode: false })],
  serverAdapter
});

const basicAuthMiddleware = basicAuth({
  users: { [config.bullBoard.username]: config.bullBoard.password },
  challenge: true
});

export { serverAdapter, basicAuthMiddleware };
