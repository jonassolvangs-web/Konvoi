-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "roles" TEXT NOT NULL DEFAULT '[]',
    "active_role" TEXT,
    "profile_image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "org_number" TEXT,
    "address" TEXT NOT NULL,
    "postal_code" TEXT,
    "city" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "distance_from_office_km" REAL,
    "distance_from_office_min" INTEGER,
    "num_units" INTEGER,
    "building_year" INTEGER,
    "management_company" TEXT,
    "chairman_name" TEXT,
    "chairman_phone" TEXT,
    "chairman_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ikke_tildelt',
    "notes" TEXT,
    "assigned_to_id" TEXT,
    "last_contacted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "organizations_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scheduled_at" DATETIME NOT NULL,
    "end_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'planlagt',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'booking',
    "status" TEXT NOT NULL DEFAULT 'planlagt',
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "visits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "visits_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dwelling_units" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "unit_number" TEXT NOT NULL,
    "floor" INTEGER,
    "resident_name" TEXT,
    "resident_phone" TEXT,
    "resident_email" TEXT,
    "visitStatus" TEXT NOT NULL DEFAULT 'ikke_besokt',
    "order_type" TEXT,
    "product" TEXT,
    "price" REAL,
    "payment_plan_months" INTEGER,
    "payment_method" TEXT,
    "sms_sent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dwelling_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "dwelling_units_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "service_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "scheduled_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planlagt',
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "signature_url" TEXT,
    "report_url" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_orders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_order_units" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "work_order_id" TEXT NOT NULL,
    "dwelling_unit_id" TEXT NOT NULL,
    "product_id" TEXT,
    "order_type" TEXT NOT NULL DEFAULT 'ventilasjonsrens',
    "product_name" TEXT,
    "price" REAL NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'ikke_betalt',
    "payment_plan_months" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ikke_startet',
    "checklist" TEXT,
    "air_before" REAL,
    "air_after" REAL,
    "photo_before_url" TEXT,
    "photo_after_url" TEXT,
    "notes" TEXT,
    "original_order_type" TEXT,
    "original_product" TEXT,
    "original_price" REAL,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_order_units_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_order_units_dwelling_unit_id_fkey" FOREIGN KEY ("dwelling_unit_id") REFERENCES "dwelling_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_order_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "service_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "filter_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dwelling_unit_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 12,
    "price_per_month" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "filter_subscriptions_dwelling_unit_id_fkey" FOREIGN KEY ("dwelling_unit_id") REFERENCES "dwelling_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "filter_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cleaning_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "completed_date" DATETIME NOT NULL,
    "next_cleaning_date" DATETIME NOT NULL,
    "reminder_status" TEXT NOT NULL DEFAULT 'ok',
    "num_units_completed" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" REAL NOT NULL DEFAULT 0,
    "avg_air_improvement" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cleaning_histories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "call_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "callback_at" DATETIME,
    "notes" TEXT,
    "duration" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "call_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "call_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel_type" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "content" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "date" DATETIME,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_org_number_key" ON "organizations"("org_number");

-- CreateIndex
CREATE INDEX "chat_messages_channel_id_created_at_idx" ON "chat_messages"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "availability_user_id_date_idx" ON "availability"("user_id", "date");

-- CreateIndex
CREATE INDEX "availability_user_id_day_of_week_idx" ON "availability"("user_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
