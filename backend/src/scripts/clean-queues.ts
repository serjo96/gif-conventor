import { conversionQueue } from '../queues';

async function cleanQueues() {
  try {
    console.log('🧹 Starting queue cleanup...');

    await conversionQueue.obliterate({ force: true });

    console.log('✅ Queues cleaned successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning queues:', error);
    process.exit(1);
  }
}

cleanQueues();
