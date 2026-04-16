-- CreateEnum
CREATE TYPE "StandupReportStatus" AS ENUM ('ACTIVE', 'ANSWERED', 'AWAY', 'CANCELED', 'UNANSWERED');

-- CreateTable
CREATE TABLE "standup_questions" (
    "id" TEXT NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "ignore_text" TEXT NOT NULL DEFAULT 'nothing nope none no -',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standup_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standup_configs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "greeting" TEXT NOT NULL DEFAULT 'Hello *{{username}}*, it''s time for your *{{config_name}}*',
    "goodbye" TEXT NOT NULL DEFAULT 'Thank you for your report.',
    "channel_id" TEXT NOT NULL,
    "channel_name" TEXT,
    "cron_hour" TEXT NOT NULL DEFAULT '9',
    "cron_minute" TEXT NOT NULL DEFAULT '0',
    "cron_day_of_week" TEXT NOT NULL DEFAULT '1-5',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "slack_integration_id" TEXT NOT NULL,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standup_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standup_config_questions" (
    "config_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "standup_config_questions_pkey" PRIMARY KEY ("config_id","question_id")
);

-- CreateTable
CREATE TABLE "standup_config_members" (
    "config_id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "username" TEXT,
    "is_away" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "standup_config_members_pkey" PRIMARY KEY ("config_id","slack_user_id")
);

-- CreateTable
CREATE TABLE "standup_reports" (
    "id" TEXT NOT NULL,
    "status" "StandupReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "slack_user_id" TEXT NOT NULL,
    "username" TEXT,
    "current_question_order" INTEGER,
    "config_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standup_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standup_answers" (
    "id" TEXT NOT NULL,
    "answer" TEXT,
    "message_ts" TEXT,
    "order" INTEGER NOT NULL,
    "report_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,

    CONSTRAINT "standup_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standup_reports_config_id_created_at_idx" ON "standup_reports"("config_id", "created_at");

-- CreateIndex
CREATE INDEX "standup_reports_slack_user_id_status_idx" ON "standup_reports"("slack_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "standup_answers_report_id_question_id_key" ON "standup_answers"("report_id", "question_id");

-- AddForeignKey
ALTER TABLE "standup_configs" ADD CONSTRAINT "standup_configs_slack_integration_id_fkey" FOREIGN KEY ("slack_integration_id") REFERENCES "slack_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_config_questions" ADD CONSTRAINT "standup_config_questions_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "standup_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_config_questions" ADD CONSTRAINT "standup_config_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "standup_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_config_members" ADD CONSTRAINT "standup_config_members_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "standup_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_reports" ADD CONSTRAINT "standup_reports_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "standup_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_answers" ADD CONSTRAINT "standup_answers_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "standup_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_answers" ADD CONSTRAINT "standup_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "standup_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
