# MP4 to GIF Converter

A scalable microservice for converting MP4 videos to optimized GIFs with queue management and monitoring capabilities.

## Overview

This service allows users to:
- Upload MP4 videos and convert them to GIFs asynchronously
- Monitor conversion progress in real-time 
- Download converted GIFs when ready
- Handle multiple concurrent conversions efficiently

### Key Features

- **Asynchronous Processing**: Uses BullMQ for reliable queue management
- **Real-time Progress**: Track conversion status through API
- **Self Recovery**: Automatic job recovery after crashes or restarts
- **Monitoring**: Built-in queue monitoring dashboard (Bull Board)
- **Load Testing**: Includes scripts for performance testing
- **Scalability**: Docker Swarm support for production deployment

### Architecture

The service consists of three main components:

- **API Server**: Handles file uploads and status requests
- **Worker Nodes**: Process video conversions using FFmpeg
- **Redis**: Manages job queues and coordinates workers

### Limitations

- Maximum video dimensions: 1024x768px
- Maximum video duration: 10 seconds
- Output GIF dimensions: Height = 400px (width scaled proportionally)
- Output GIF framerate: 5 FPS
- Maximum concurrent jobs per worker: 3
- Rate limit: 1000 requests per minute 

## Technologies

### Backend
- Node.js with Express
- BullMQ for job queue management
- Redis for queue storage
- FFmpeg for video processing
- TypeScript for type safety

### Frontend  
- Angular 19
- Angular Material UI components
- RxJS for reactive programming
- TypeScript

### Infrastructure
- Docker & Docker Compose for local development
- Docker Swarm for production deployment
- Redis for queue persistence

### Development Tools
- Yarn for package management
- ESLint & Prettier for code quality
- Nodemon for development reload
- TypeScript compiler
- Load testing scripts

### Monitoring
- Bull Board UI for queue monitoring
- Docker logs aggregation
- Health check endpoints 

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Yarn package manager (`npm install -g yarn`)
- Docker and Docker Compose
- FFmpeg installed locally (for development)

### Environment Setup

1. Clone and install dependencies:

```bash
git clone https://github.com/username/mp4-to-gif-converter.git
cd mp4-to-gif-converter
yarn install
```

2. Configure environment:

```bash
# Copy example configuration
cp .env.example .env
```

Required environment variables:
```bash
# Redis connection (leave password empty if no auth required)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Bull Board monitoring UI credentials
BULL_BOARD_USER=admin    # Username for /admin/queues dashboard
BULL_BOARD_PASS=admin    # Password for /admin/queues dashboard

# Optional settings
PORT=3000                # API server port
NODE_ENV=development     # development or production
CORS_ORIGIN=http://localhost:4200
```

### Development

Start all services:
```bash
docker compose up
```

Or run services individually:
```bash
yarn dev    # API server
yarn worker # Conversion worker
```

Access:
- Frontend: http://localhost:4200
- API: http://localhost:3000
- Queue Monitor: http://localhost:3000/admin/queues

## Monitoring

- Queue monitoring dashboard available at `/admin/queues`
- View logs: `docker compose logs -f` (development) or `docker service logs -f gif-converter_backend` (production)
- Health check endpoint: `GET /health/ping`

## Self Recovery

The service automatically recovers after crashes or restarts:
- Failed jobs are retried automatically
- Incomplete conversions are resumed
- Queue state is persisted in Redis

## Performance

Default configuration:
- 1000 requests per minute rate limit
- 3 concurrent jobs per worker
- 5 worker instances in production deployment

## Load Testing

### Running Load Tests

The project includes a simple load testing script to simulate concurrent uploads:

```bash
# Basic test with default settings (100 requests, 10 parallel)
./backend/tests/simple_load_test.sh -f path/to/test.mp4

# Custom test parameters
./backend/tests/simple_load_test.sh \
  -f path/to/test.mp4 \
  -n 1000 \            # Number of requests
  -p 20 \              # Max parallel requests
  -u http://localhost:3000/api/conversion/upload
```

Parameters:
- `-f`: Test file path (required)
- `-n`: Number of requests (default: 100)
- `-p`: Max parallel requests (default: 10)
- `-u`: API URL (default: http://localhost:3000/api/conversion/upload)

### Test Results

The script provides real-time statistics including:
- Total requests completed
- Success/failure rates
- Average response time
- Requests per second
- Status code distribution

### Performance Metrics

Default configuration handles:
- 1000 requests per minute rate limit
- 3 concurrent jobs per worker
- 5 worker instances in production deployment

## API Documentation

### Upload Video

Convert MP4 to GIF by uploading a video file.

```bash
POST /api/conversion/upload
Content-Type: multipart/form-data

# Request body
file: <video_file>

# Response
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Check Conversion Status

Get the status of a conversion job.

```bash
GET /api/conversion/status/:jobId

# Response
{
  "success": true,
  "data": {
    "status": "completed", // pending, processing, completed, failed
    "progress": 100,
    "outputUrl": "/api/conversion/download/example.gif",
    "error": null
  }
}
```

### Batch Status Check

Check status for multiple conversion jobs.

```bash
POST /api/conversion/status
Content-Type: application/json

# Request body
{
  "jobIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "650e8400-e29b-41d4-a716-446655440001"
  ]
}

# Response
{
  "success": true,
  "data": {
    "jobs": [
      {
        "jobId": "550e8400-e29b-41d4-a716-446655440000",
        "status": "completed",
        "outputUrl": "/api/conversion/download/example1.gif"
      },
      {
        "jobId": "650e8400-e29b-41d4-a716-446655440001",
        "status": "processing",
        "progress": 45
      }
    ]
  }
}
``` 

## Monitoring & Logging

### Bull Board Dashboard

Access the queue monitoring UI at `/admin/queues`:

```bash
# Default credentials
Username: admin
Password: admin
```

Features:
- View active, completed, and failed jobs
- Track job progress and status
- Retry failed jobs
- View job details and error logs

### Health Checks

Monitor service health using the following endpoints:

```bash
# API Server health
GET /health/ping

# Response
{
  "success": true,
  "data": {
    "status": "ok",
    "redis": true
  }
}
```

### Docker Logs

View service logs in development:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f worker
```

View logs in production:

```bash
# All services
docker service logs gif-converter_backend
docker service logs gif-converter_worker

# Follow logs
docker service logs -f gif-converter_backend
```

### Recovery Testing

Test system recovery after failures:

```bash
# Run recovery tests
yarn test:recovery

# Clean up queues
yarn clean-queues
``` 

## Load Testing

### Running Load Tests

The project includes a simple load testing script to simulate concurrent uploads:

```bash
# Basic test with default settings (100 requests, 10 parallel)
./backend/tests/simple_load_test.sh -f path/to/test.mp4

# Custom test parameters
./backend/tests/simple_load_test.sh \
  -f path/to/test.mp4 \
  -n 1000 \            # Number of requests
  -p 20 \              # Max parallel requests
  -u http://localhost:3000/api/conversion/upload
```

Parameters:
- `-f`: Test file path (required)
- `-n`: Number of requests (default: 100)
- `-p`: Max parallel requests (default: 10)
- `-u`: API URL (default: http://localhost:3000/api/conversion/upload)

### Test Results

The script provides real-time statistics including:
- Total requests completed
- Success/failure rates
- Average response time
- Requests per second
- Status code distribution

### Performance Metrics

Default configuration handles:
- 1000 requests per minute rate limit
- 3 concurrent jobs per worker
- 5 worker instances in production deployment

### Project Structure

```
.
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── controllers/    # Request handlers
│   │   ├── queues/        # BullMQ setup
│   │   ├── services/      # Business logic
│   │   └── utils/         # Helper functions
│   └── scripts/           # Utility scripts
├── frontend/              # Angular application
│   └── src/
│       ├── app/
│       │   └── features/  # Feature modules
│       └── environments/  # Environment configs
└── docker/               # Docker configurations
``` 
