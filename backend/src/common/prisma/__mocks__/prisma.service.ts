// Mock PrismaService pour les tests unitaires
// Utilise un store en mémoire pour simuler la base de données

export class MockPrismaService {
  private store: Record<string, Map<string, any>> = {};
  private idCounter = 0;

  constructor() {
    this.resetStore();
  }

  private nextId(prefix: string) {
    return `${prefix}-${Date.now()}-${++this.idCounter}`;
  }

  resetStore() {
    this.store = {
      user: new Map(),
      article: new Map(),
      conversation: new Map(),
      message: new Map(),
      transaction: new Map(),
      notificationHistory: new Map(),
      favori: new Map(),
    };
    this.idCounter = 0;
  }

  // ─── User ──────────────────────────────────────────────────────────────

  user = {
    findUnique: async (args: { where: { id?: string; phone?: string } }) => {
      const users = Array.from(this.store.user.values());
      if (args.where.id) return users.find((u) => u.id === args.where.id) || null;
      if (args.where.phone) return users.find((u) => u.phone === args.where.phone) || null;
      return null;
    },
    findFirst: async (args: any) => {
      const users = Array.from(this.store.user.values());
      if (args?.where?.id) return users.find((u) => u.id === args.where.id) || null;
      return null;
    },
    findMany: async (args?: any) => {
      return Array.from(this.store.user.values());
    },
    create: async (args: { data: any }) => {
      const id = args.data.id || this.nextId('user');
      const user = { id, ...args.data, dateCreation: args.data.dateCreation || new Date(), updatedAt: new Date() };
      this.store.user.set(id, user);
      return user;
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const existing = this.store.user.get(args.where.id);
      if (!existing) return null;
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      this.store.user.set(args.where.id, updated);
      return updated;
    },
    upsert: async (args: { where: { phone: string }; update: any; create: any }) => {
      const users = Array.from(this.store.user.values());
      const existing = users.find((u) => u.phone === args.where.phone);
      if (existing) {
        const updated = { ...existing, ...args.update };
        this.store.user.set(existing.id, updated);
        return updated;
      }
      const id = `user-${Date.now()}`;
      const user = { id, ...args.create, dateCreation: new Date(), updatedAt: new Date() };
      this.store.user.set(id, user);
      return user;
    },
    count: async (args?: any) => {
      return Array.from(this.store.user.values()).length;
    },
  };

  // ─── Article ───────────────────────────────────────────────────────────

  private resolveArticleIncludes(article: any, include?: any) {
    if (!include || !article) return article;
    const result = { ...article };
    if (include.vendeur && article.vendeurId) {
      result.vendeur = this.store.user.get(article.vendeurId) || null;
      if (include.vendeur.select && result.vendeur) {
        const selected: any = {};
        for (const key of Object.keys(include.vendeur.select)) {
          if (key in result.vendeur) selected[key] = result.vendeur[key];
        }
        result.vendeur = selected;
      }
    }
    if (include.transactions) {
      const transactions = Array.from(this.store.transaction.values());
      result.transactions = transactions.filter(
        (t: any) => t.articleId === article.id && include.transactions.where?.statutEscrow?.in?.includes(t.statutEscrow)
      ).map((t: any) => {
        const selected: any = {};
        if (include.transactions.select) {
          for (const key of Object.keys(include.transactions.select)) {
            if (key in t) selected[key] = t[key];
          }
        }
        return Object.keys(selected).length ? selected : t;
      });
    }
    return result;
  }

  private matchWhere(item: any, where: any): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') {
        return (value as any[]).some((condition) => this.matchWhere(item, condition));
      }
      if (key === 'AND') {
        return (value as any[]).every((condition) => this.matchWhere(item, condition));
      }
      if (key === 'NOT') {
        return !this.matchWhere(item, value as any);
      }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const objValue = value as Record<string, any>;
        // Opérateurs Prisma : contains, gte, lte, in, not, etc.
        if ('contains' in objValue) {
          const itemVal = String(item[key] ?? '').toLowerCase();
          return itemVal.includes(String(objValue.contains).toLowerCase());
        }
        if ('mode' in objValue) {
          // mode: 'insensitive' est implicite dans contains, on l'ignore
          return this.matchWhere(item, { ...objValue, mode: undefined });
        }
        if ('gte' in objValue && 'lte' in objValue) {
          return Number(item[key]) >= Number(objValue.gte) && Number(item[key]) <= Number(objValue.lte);
        }
        if ('gte' in objValue) {
          return Number(item[key]) >= Number(objValue.gte);
        }
        if ('lte' in objValue) {
          return Number(item[key]) <= Number(objValue.lte);
        }
        if ('in' in objValue) {
          return (objValue.in as any[]).includes(item[key]);
        }
        if ('not' in objValue) {
          return item[key] !== objValue.not;
        }
      }
      return item[key] === value;
    });
  }

  article = {
    findUnique: async (args: { where: { id: string }; include?: any }) => {
      const article = this.store.article.get(args.where.id) || null;
      return this.resolveArticleIncludes(article, args.include);
    },
    findFirst: async (args: any) => {
      const articles = Array.from(this.store.article.values());
      if (args?.where?.id) {
        const article = articles.find((a) => a.id === args.where.id) || null;
        return this.resolveArticleIncludes(article, args.include);
      }
      return null;
    },
    findMany: async (args?: any) => {
      let results = Array.from(this.store.article.values());
      if (args?.where) {
        results = results.filter((item) => this.matchWhere(item, args.where));
      }
      if (args?.orderBy?.dateCreation === 'desc') {
        results.sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime());
      }
      if (args?.include?.vendeur) {
        results = results.map((a) => this.resolveArticleIncludes(a, args.include));
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = args.data.id || this.nextId('article');
      const article = { id, ...args.data, dateCreation: args.data.dateCreation || new Date(), updatedAt: new Date() };
      this.store.article.set(id, article);
      return article;
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const existing = this.store.article.get(args.where.id);
      if (!existing) return null;
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      this.store.article.set(args.where.id, updated);
      return updated;
    },
    delete: async (args: { where: { id: string } }) => {
      this.store.article.delete(args.where.id);
      return { id: args.where.id };
    },
    count: async (args?: any) => {
      return Array.from(this.store.article.values()).length;
    },
  };

  // ─── Conversation ──────────────────────────────────────────────────────

  private resolveConversationIncludes(conv: any, include?: any) {
    if (!include || !conv) return conv;
    const result = { ...conv };
    if (include.article && conv.articleId) {
      const article = this.store.article.get(conv.articleId) || null;
      if (article && include.article.select) {
        const selected: any = {};
        for (const key of Object.keys(include.article.select)) {
          if (key in article) selected[key] = article[key];
        }
        result.article = selected;
      } else {
        result.article = article;
      }
    }
    if (include.acheteur && conv.acheteurId) {
      const user = this.store.user.get(conv.acheteurId) || null;
      if (user && include.acheteur.select) {
        const selected: any = {};
        for (const key of Object.keys(include.acheteur.select)) {
          if (key in user) selected[key] = user[key];
        }
        result.acheteur = selected;
      } else {
        result.acheteur = user;
      }
    }
    if (include.vendeur && conv.vendeurId) {
      const user = this.store.user.get(conv.vendeurId) || null;
      if (user && include.vendeur.select) {
        const selected: any = {};
        for (const key of Object.keys(include.vendeur.select)) {
          if (key in user) selected[key] = user[key];
        }
        result.vendeur = selected;
      } else {
        result.vendeur = user;
      }
    }
    if (include.messages) {
      let messages = Array.from(this.store.message.values()).filter(
        (m: any) => m.conversationId === conv.id,
      );
      if (include.messages.orderBy?.timestamp === 'asc') {
        messages.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
      if (include.messages.orderBy?.timestamp === 'desc') {
        messages.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      if (include.messages.take) {
        messages = messages.slice(0, include.messages.take);
      }
      if (include.messages.include?.expediteur) {
        messages = messages.map((m: any) => ({
          ...m,
          expediteur: this.store.user.get(m.expediteurId) || null,
        }));
      }
      result.messages = messages;
    }
    return result;
  }

  conversation = {
    findUnique: async (args: { where: { id: string }; include?: any }) => {
      const conv = this.store.conversation.get(args.where.id) || null;
      return this.resolveConversationIncludes(conv, args.include);
    },
    findFirst: async (args: any) => {
      const convs = Array.from(this.store.conversation.values());
      if (args?.where) {
        const found = convs.find((c) => this.matchWhere(c, args.where)) || null;
        return this.resolveConversationIncludes(found, args.include);
      }
      return null;
    },
    findMany: async (args?: any) => {
      let results = Array.from(this.store.conversation.values());
      if (args?.where) {
        results = results.filter((item) => this.matchWhere(item, args.where));
      }
      if (args?.orderBy?.updatedAt === 'desc') {
        results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }
      if (args?.include) {
        results = results.map((c) => this.resolveConversationIncludes(c, args.include));
      }
      return results;
    },
    create: async (args: { data: any; include?: any }) => {
      const id = args.data.id || this.nextId('conv');
      const conv = { id, ...args.data, dateCreation: args.data.dateCreation || new Date(), updatedAt: new Date() };
      this.store.conversation.set(id, conv);
      if (args.include) {
        return this.resolveConversationIncludes(conv, args.include);
      }
      return conv;
    },
  };

  // ─── Message ───────────────────────────────────────────────────────────

  message = {
    create: async (args: { data: any }) => {
      const id = args.data.id || this.nextId('msg');
      const msg = { id, ...args.data, timestamp: new Date() };
      this.store.message.set(id, msg);
      return msg;
    },
    updateMany: async (args: { where: any; data: any }) => {
      let count = 0;
      this.store.message.forEach((msg, id) => {
        // Filtre basique : vérifier conversationId, expediteurId (not), lu
        if (args.where.conversationId && msg.conversationId !== args.where.conversationId) return;
        if (args.where.expediteurId?.not && msg.expediteurId === args.where.expediteurId.not) return;
        if (args.where.lu !== undefined && msg.lu !== args.where.lu) return;
        this.store.message.set(id, { ...msg, ...args.data });
        count++;
      });
      return { count };
    },
  };

  // ─── Transaction ───────────────────────────────────────────────────────

  transaction = {
    findUnique: async (args: { where: { id: string }; include?: any }) => {
      const t = this.store.transaction.get(args.where.id) || null;
      if (!t || !args.include) return t;
      // Simuler les includes
      const result = { ...t };
      if (args.include.article && t.articleId) {
        result.article = this.store.article.get(t.articleId) || null;
      }
      if (args.include.acheteur && t.acheteurId) {
        result.acheteur = this.store.user.get(t.acheteurId) || null;
      }
      if (args.include.vendeur && t.vendeurId) {
        result.vendeur = this.store.user.get(t.vendeurId) || null;
      }
      return result;
    },
    findFirst: async (args: any) => {
      const transactions = Array.from(this.store.transaction.values());
      if (args?.where?.id) return transactions.find((t) => t.id === args.where.id) || null;
      if (args?.where?.articleId && args?.where?.acheteurId) {
        return transactions.find(
          (t) => t.articleId === args.where.articleId && t.acheteurId === args.where.acheteurId && args.where.statutEscrow?.in?.includes(t.statutEscrow)
        ) || null;
      }
      return null;
    },
    findMany: async (args?: any) => {
      let results = Array.from(this.store.transaction.values());
      if (args?.where) {
        if (args.where.acheteurId && args.where.vendeurId) {
          results = results.filter((t) => t.acheteurId === args.where.acheteurId && t.vendeurId === args.where.vendeurId);
        }
        if (args.where.OR) {
          results = results.filter((t) =>
            args.where.OR.some((condition: any) =>
              Object.entries(condition).every(([key, val]) => t[key] === val),
            ),
          );
        }
      }
      if (args?.orderBy?.dateCreation === 'desc') {
        results.sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime());
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = args.data.id || this.nextId('tx');
      const transaction = { id, ...args.data, dateCreation: args.data.dateCreation || new Date() };
      this.store.transaction.set(id, transaction);
      return transaction;
    },
    update: async (args: { where: { id: string }; data: any; include?: any }) => {
      const existing = this.store.transaction.get(args.where.id);
      if (!existing) return null;
      const updated = { ...existing, ...args.data };
      this.store.transaction.set(args.where.id, updated);
      if (args.include) {
        const result = { ...updated };
        if (args.include.article && updated.articleId) {
          result.article = this.store.article.get(updated.articleId) || null;
        }
        return result;
      }
      return updated;
    },
    count: async (args?: any) => {
      return Array.from(this.store.transaction.values()).length;
    },
    aggregate: async (args?: any) => {
      return { _sum: { montant: 100000, fraisService: 5000 } };
    },
    groupBy: async (args?: any) => {
      if (args.by?.includes('moyenPaiement')) {
        return [{ moyenPaiement: 'ORANGE_MONEY', _count: { id: 5 }, _sum: { montant: 50000 } }];
      }
      if (args.by?.includes('statutEscrow')) {
        return [{ statutEscrow: 'LIBERE', _count: { id: 3 } }];
      }
      return [];
    },
  };

  // ─── NotificationHistory ───────────────────────────────────────────────

  notificationHistory = {
    create: async (args: { data: any }) => {
      const id = args.data.id || this.nextId('notif');
      const notif = { id, dateCreation: new Date(), ...args.data };
      this.store.notificationHistory.set(id, notif);
      return notif;
    },
    findMany: async (args?: any) => {
      let results = Array.from(this.store.notificationHistory.values());
      if (args?.where?.userId) {
        results = results.filter((n) => n.userId === args.where.userId);
      }
      if (args?.orderBy?.dateCreation === 'desc') {
        results.sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime());
      }
      if (args?.skip) results = results.slice(args.skip);
      if (args?.take) results = results.slice(0, args.take);
      return results;
    },
    count: async (args?: any) => {
      let results = Array.from(this.store.notificationHistory.values());
      if (args?.where?.userId) {
        results = results.filter((n) => n.userId === args.where.userId);
      }
      if (args?.where?.status) {
        results = results.filter((n) => n.status === args.where.status);
      }
      return results.length;
    },
    updateMany: async (args: { where: { id?: string; userId?: string; status?: string }; data: any }) => {
      this.store.notificationHistory.forEach((notif, id) => {
        if (args.where.userId && notif.userId !== args.where.userId) return;
        if (args.where.id && notif.id !== args.where.id) return;
        if (args.where.status && notif.status !== args.where.status) return;
        this.store.notificationHistory.set(id, { ...notif, ...args.data });
      });
    },
  };

  // ─── Favori ────────────────────────────────────────────────────────────

  favori = {
    findUnique: async (args: { where: { userId_articleId: { userId: string; articleId: string } } }) => {
      const favoris = Array.from(this.store.favori.values());
      return favoris.find(
        (f) => f.userId === args.where.userId_articleId.userId && f.articleId === args.where.userId_articleId.articleId
      ) || null;
    },
    findMany: async (args?: any) => {
      let results = Array.from(this.store.favori.values());
      if (args?.where?.userId) {
        results = results.filter((f) => f.userId === args.where.userId);
      }
      if (args?.orderBy?.dateCreation === 'desc') {
        results.sort((a: any, b: any) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime());
      }
      if (args?.include?.article) {
        results = results.map((f: any) => {
          const article = this.store.article.get(f.articleId) || null;
          if (article && args.include.article.include?.vendeur && article.vendeurId) {
            const vendeur = this.store.user.get(article.vendeurId) || null;
            const nested = args.include.article.include.vendeur;
            if (vendeur && nested.select) {
              const selected: any = {};
              for (const key of Object.keys(nested.select)) {
                if (key in vendeur) selected[key] = vendeur[key];
              }
              (article as any).vendeur = selected;
            } else {
              (article as any).vendeur = vendeur;
            }
          }
          return { ...f, article };
        });
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const id = args.data.id || this.nextId('fav');
      const favori = { id, ...args.data, dateCreation: args.data.dateCreation || new Date() };
      this.store.favori.set(id, favori);
      return favori;
    },
    delete: async (args: { where: { id: string } }) => {
      this.store.favori.delete(args.where.id);
      return { id: args.where.id };
    },
  };

  // ─── Helpers spécifiques ──────────────────────────────────────────────

  addFcmToken = async (userId: string, token: string) => {
    const user = this.store.user.get(userId);
    if (!user) return;
    const tokens = user.fcmTokens || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
      this.store.user.set(userId, { ...user, fcmTokens: tokens });
    }
  };

  removeFcmToken = async (userId: string, token: string) => {
    const user = this.store.user.get(userId);
    if (!user) return;
    this.store.user.set(userId, {
      ...user,
      fcmTokens: (user.fcmTokens || []).filter((t: string) => t !== token),
    });
  };
}
