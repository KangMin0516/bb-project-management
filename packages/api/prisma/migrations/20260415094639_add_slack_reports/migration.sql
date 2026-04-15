-- CreateTable
CREATE TABLE "slack_integrations" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "bot_token" TEXT NOT NULL,
    "installed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "morning_time" TEXT NOT NULL DEFAULT '09:00',
    "morning_channel_id" TEXT,
    "morning_channel_name" TEXT,
    "lunch_time" TEXT NOT NULL DEFAULT '13:00',
    "lunch_channel_id" TEXT,
    "lunch_channel_name" TEXT,
    "evening_time" TEXT NOT NULL DEFAULT '18:00',
    "evening_channel_id" TEXT,
    "evening_channel_name" TEXT,
    "skip_weekends" BOOLEAN NOT NULL DEFAULT true,
    "morning_last_sent" TIMESTAMP(3),
    "lunch_last_sent" TIMESTAMP(3),
    "evening_last_sent" TIMESTAMP(3),
    "project_id" TEXT NOT NULL,
    "slack_integration_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_report_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_integrations_team_id_key" ON "slack_integrations"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_configs_project_id_key" ON "daily_report_configs"("project_id");

-- AddForeignKey
ALTER TABLE "slack_integrations" ADD CONSTRAINT "slack_integrations_installed_by_id_fkey" FOREIGN KEY ("installed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_configs" ADD CONSTRAINT "daily_report_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_configs" ADD CONSTRAINT "daily_report_configs_slack_integration_id_fkey" FOREIGN KEY ("slack_integration_id") REFERENCES "slack_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
