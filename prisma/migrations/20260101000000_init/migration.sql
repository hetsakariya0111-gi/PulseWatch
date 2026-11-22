-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MonitorType" AS ENUM ('WEBSITE', 'API');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'HEAD', 'POST');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('UNKNOWN', 'UP', 'DOWN');

-- CreateEnum
CREATE TYPE "CheckErrorType" AS ENUM ('TIMEOUT', 'DNS_FAILURE', 'TLS_ERROR', 'UNEXPECTED_STATUS', 'CONNECTION_ERROR', 'SSRF_BLOCKED', 'TOO_MANY_REDIRECTS', 'RESPONSE_TOO_LARGE', 'INVALID_URL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "hashedPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("sessionToken")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "type" "MonitorType" NOT NULL DEFAULT 'WEBSITE',
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "expectedStatusCodes" INTEGER[] DEFAULT ARRAY[200]::INTEGER[],
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "failureThreshold" INTEGER NOT NULL DEFAULT 2,
    "recoveryThreshold" INTEGER NOT NULL DEFAULT 1,
    "status" "MonitorStatus" NOT NULL DEFAULT 'UNKNOWN',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_results" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "errorType" "CheckErrorType",
    "errorMessage" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_updates" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "IncidentStatus",
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_pages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_rollups" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalChecks" INTEGER NOT NULL DEFAULT 0,
    "successChecks" INTEGER NOT NULL DEFAULT 0,
    "failChecks" INTEGER NOT NULL DEFAULT 0,
    "sumResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "minResponseTimeMs" INTEGER,
    "maxResponseTimeMs" INTEGER,
    "downtimeMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "monitors_projectId_idx" ON "monitors"("projectId");

-- CreateIndex
CREATE INDEX "monitors_enabled_nextCheckAt_idx" ON "monitors"("enabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "monitors_projectId_createdAt_idx" ON "monitors"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "check_results_monitorId_checkedAt_idx" ON "check_results"("monitorId", "checkedAt" DESC);

-- CreateIndex
CREATE INDEX "check_results_monitorId_success_idx" ON "check_results"("monitorId", "success");

-- CreateIndex
CREATE INDEX "check_results_checkedAt_idx" ON "check_results"("checkedAt");

-- CreateIndex
CREATE INDEX "incidents_monitorId_startedAt_idx" ON "incidents"("monitorId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "incidents_status_startedAt_idx" ON "incidents"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "incident_updates_incidentId_createdAt_idx" ON "incident_updates"("incidentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "status_pages_projectId_key" ON "status_pages"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "status_pages_slug_key" ON "status_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "daily_rollups_monitorId_date_key" ON "daily_rollups"("monitorId", "date");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_pages" ADD CONSTRAINT "status_pages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_rollups" ADD CONSTRAINT "daily_rollups_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
