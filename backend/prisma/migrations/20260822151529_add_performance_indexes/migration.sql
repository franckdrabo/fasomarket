-- CreateIndex
CREATE INDEX "idx_articles_vendeurId" ON "articles"("vendeurId");

-- CreateIndex
CREATE INDEX "idx_avis_auteurId" ON "avis"("auteurId");

-- CreateIndex
CREATE INDEX "idx_avis_cibleId" ON "avis"("cibleId");

-- CreateIndex
CREATE INDEX "idx_conversations_acheteurId" ON "conversations"("acheteurId");

-- CreateIndex
CREATE INDEX "idx_conversations_vendeurId" ON "conversations"("vendeurId");

-- CreateIndex
CREATE INDEX "idx_conversations_articleId" ON "conversations"("articleId");

-- CreateIndex
CREATE INDEX "idx_messages_conversationId" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "idx_messages_expediteurId" ON "messages"("expediteurId");

-- CreateIndex
CREATE INDEX "idx_notification_history_userId" ON "notification_history"("userId");

-- CreateIndex
CREATE INDEX "idx_notification_history_userId_status" ON "notification_history"("userId", "status");

-- CreateIndex
CREATE INDEX "idx_transactions_acheteurId" ON "transactions"("acheteurId");

-- CreateIndex
CREATE INDEX "idx_transactions_vendeurId" ON "transactions"("vendeurId");

-- CreateIndex
CREATE INDEX "idx_transactions_articleId" ON "transactions"("articleId");

-- CreateIndex
CREATE INDEX "idx_transactions_statutEscrow" ON "transactions"("statutEscrow");
