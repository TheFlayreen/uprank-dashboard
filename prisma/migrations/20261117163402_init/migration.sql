-- CreateTable
CREATE TABLE "sync_runs" (
    "id" SERIAL NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reference_date" TIMESTAMP(3),
    "counts" JSONB,
    "error" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "delinquent" BOOLEAN NOT NULL,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "canceled_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "cancel_feedback" TEXT,
    "cancel_comment" TEXT,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscription_items" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "price_id" TEXT NOT NULL,
    "price_nickname" TEXT,
    "product_id" TEXT NOT NULL,
    "unit_amount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "interval" TEXT NOT NULL,
    "interval_count" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "status" TEXT NOT NULL,
    "billing_reason" TEXT,
    "amount_due" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL,
    "credit_notes_amount" INTEGER NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "next_payment_attempt" TIMESTAMP(3),

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_clients" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "trade" TEXT,
    "region" TEXT,
    "stripe_customer_id" TEXT,
    "status" TEXT NOT NULL,
    "signup_at" TIMESTAMP(3) NOT NULL,
    "assets_received_at" TIMESTAMP(3),
    "site_approved_at" TIMESTAMP(3),
    "live_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "ads_enabled" BOOLEAN NOT NULL,
    "ads_monthly_budget" INTEGER,
    "ads_enabled_at" TIMESTAMP(3),

    CONSTRAINT "product_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_lead_months" (
    "client_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "leads" INTEGER NOT NULL,

    CONSTRAINT "product_lead_months_pkey" PRIMARY KEY ("client_id","month")
);

-- CreateTable
CREATE TABLE "product_support_tickets" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "product_support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_subscriptions_customer_id_idx" ON "billing_subscriptions"("customer_id");

-- CreateIndex
CREATE INDEX "billing_subscription_items_subscription_id_idx" ON "billing_subscription_items"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_invoices_customer_id_idx" ON "billing_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "product_clients_stripe_customer_id_idx" ON "product_clients"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "product_support_tickets_client_id_idx" ON "product_support_tickets"("client_id");

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lead_months" ADD CONSTRAINT "product_lead_months_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "product_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_support_tickets" ADD CONSTRAINT "product_support_tickets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "product_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
