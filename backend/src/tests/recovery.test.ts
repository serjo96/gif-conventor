import { Queue, Worker } from 'bullmq';
import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';

async function testRecovery() {
  // Setup test queue
  const testQueue = new Queue('test-recovery', {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password
    }
  });

  // Create test file
  const testFilePath = path.join(__dirname, '../../uploads/test.txt');
  await fs.writeFile(testFilePath, 'test content');

  // Test 1: Job persistence after crash
  console.log('\n🧪 Test 1: Job persistence after crash');
  const job1 = await testQueue.add('test', {
    filePath: testFilePath,
    shouldFail: false
  });
  console.log(`Added job ${job1.id} to queue`);

  // Test 2: Retry mechanism
  console.log('\n🧪 Test 2: Retry mechanism');
  const job2 = await testQueue.add(
    'test',
    {
      filePath: testFilePath,
      shouldFail: true
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    }
  );
  console.log(`Added job ${job2.id} to queue`);

  // Create test worker
  const worker = new Worker(
    'test-recovery',
    async (job) => {
      console.log(`Processing job ${job.id}, attempt ${job.attemptsMade + 1}`);

      if (job.data.shouldFail) {
        throw new Error('Simulated failure');
      }

      await fs.access(job.data.filePath);
      return { success: true };
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password
      }
    }
  );

  // Log events
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    console.log(`❌ Job ${job.id} failed:`, err.message);
    console.log(`Attempts made: ${job.attemptsMade} of ${job.opts.attempts}`);
  });

  // Wait for jobs to complete
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Cleanup
  await worker.close();
  await testQueue.close();
  await fs.unlink(testFilePath).catch(() => {});

  console.log('\n✨ Recovery test completed');
}

// Run tests
testRecovery().catch(console.error);
