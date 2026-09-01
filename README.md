# Website Builder Backend

This is the backend service for the contractor website builder. It is built with [NestJS](https://nestjs.com/) and uses PostgreSQL and Redis.

## Prerequisites
- [Node.js](https://nodejs.org/en/) (v18 or higher recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for running the database and Redis locally)

## Getting Started Locally

### 1. Environment Variables
Copy the `.env.example` file to create your local `.env` file:
```bash
cp .env.example .env
```
*(The default values should work out of the box for local development).*

### 2. Install Dependencies
Install all the required Node.js packages:
```bash
npm install
```

### 3. Start Database and Redis
Use Docker to spin up the local PostgreSQL database and Redis containers in the background:
```bash
docker compose up -d
```

### 4. Setup the Database
Generate the Prisma database client and push the schema to your local database:
```bash
npx prisma generate
npx prisma db push
```

### 5. Run the Server
Finally, start the NestJS development server:
```bash
# Watch mode for local development
npm run start:dev
```
The backend API will now be running on `http://localhost:3000` (or whichever port you specified in `.env`).

## Deployment (Sliplane)
This backend includes a `Dockerfile` and is ready to be hosted on Sliplane. 
When deploying, make sure to:
1. Add your repository to Sliplane.
2. Provide all the required environment variables found in `.env.example` within the Sliplane dashboard.
3. Your deployment will build automatically from the `Dockerfile`.
