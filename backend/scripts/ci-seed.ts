/**
 * Script de seed pour l'environnement CI
 * Crée des données de test réalistes pour les tests de performance K6
 *
 * Usage: npx ts-node scripts/ci-seed.ts
 * Prérequis: DATABASE_URL configurée, Prisma client généré
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Ces valeurs doivent correspondre aux enums du schema Prisma
const CATEGORIES: string[] = [
  'VETEMENTS',
  'CHAUSSURES',
  'ELECTRONIQUE',
  'MAISON',
  'AUTRES',
];

const ETATS: string[] = ['NEUF', 'COMME_NEUF', 'BON_ETAT', 'SATISFAISANT'];

const VILLES = ['Abidjan', 'Dakar', 'Bamako', 'Ouagadougou', 'Yaoundé', 'Lomé', 'Cotonou'];

const TITRES_ARTICLES = [
  'iPhone 15 Pro Max 256 Go',
  'Samsung Galaxy S24 Ultra',
  'MacBook Air M3 15 pouces',
  'Canapé 3 places en cuir',
  'Table basse design scandinave',
  'Lit king size avec sommier',
  'Robe de soirée Dolce & Gabbana',
  'Montre Rolex Submariner',
  'Sac à main Louis Vuitton',
  'Toyota Corolla 2022',
  'Mercedes-Benz Classe C 2021',
  'Yamaha MT-07 2023',
  'Vélo électrique Giant',
  'Machine à café Jura',
  'Téléviseur OLED 65 pouces Sony',
  'PlayStation 5 avec manettes',
  'Appartement 3 pièces Cocody',
  'Villa avec piscine Angré',
  'Terrain constructible 500m²',
  'Cours de soutien scolaire en ligne',
  'Service de photographie mariage',
  'Coaching sportif à domicile',
  'Guitare Fender Stratocaster',
  'Appareil photo Canon EOS R5',
  'Drone DJI Mavic 3 Pro',
  'Bureau debout électrique',
  'Chaise ergonomique Herman Miller',
  'Aspirateur robot Dyson',
  'Climatiseur réversible 12000 BTU',
  'Piscine hors-sol 6m x 3m',
];

const DESCRIPTIONS = [
  'Excellent état, très peu utilisé. Vendu avec accessoires d\'origine et facture.',
  'Comme neuf, ouvert uniquement pour vérification. Garantie constructeur en cours.',
  'Bon état général, quelques traces d\'usage mineures. Prix négociable.',
  'État neuf, encore dans son emballage d\'origine. Livraison possible.',
  'Très bon état, entretenu régulièrement. Vente pour cause de déménagement.',
  'Occasion en parfait état de fonctionnement. Révisé récemment.',
  'État correct, fonctionnel mais avec quelques signes d\'usage visibles.',
  'Neuf sous blister, jamais utilisé. Facture d\'achat disponible.',
  'Bon état, vendu avec garantie 6 mois. Possibilité de test sur place.',
  'Article haut de gamme en excellent état. Prix ferme.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const prefixes = ['+22501', '+22177', '+22370', '+22670', '+23769', '+22870', '+22901'];
  const prefix = pickRandom(prefixes);
  const suffix = String(randomInt(1000000, 9999999));
  return prefix + suffix;
}  function generatePrice(categorie: string): number {
  switch (categorie) {
    case 'ELECTRONIQUE':
      return randomInt(50000, 2000000);
    case 'MAISON':
      return randomInt(50000, 1500000);
    case 'VETEMENTS':
      return randomInt(10000, 500000);
    case 'CHAUSSURES':
      return randomInt(10000, 300000);
    default:
      return randomInt(10000, 1000000);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-do-not-use-in-production';
const LOAD_TEST_DIR = path.join(__dirname, '..', 'load-tests');

async function main() {
  console.log('🌱 Seeding test data for CI...');

  // S'assurer que le répertoire load-tests existe
  if (!fs.existsSync(LOAD_TEST_DIR)) {
    fs.mkdirSync(LOAD_TEST_DIR, { recursive: true });
  }

  // Nettoyer les données existantes
  await prisma.notificationHistory.deleteMany();
  await prisma.favori.deleteMany();
  await prisma.message.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.article.deleteMany();
  await prisma.user.deleteMany();

  // ─── Créer des utilisateurs ─────────────────────────────────────────────

  console.log('👤 Creating users...');
  const users: any[] = [];

  // Utilisateurs de test pour les tests de chat (numéros fixes)
  const testPhones = [
    '+22501000001', '+22501000002', '+22501000003', '+22501000004',
    '+22501000005', '+22501000006', '+22501000007', '+22501000008',
    '+22501000009', '+22501000010',
  ];

  const tokens: Record<string, string> = {};

  for (let i = 0; i < testPhones.length; i++) {
    const user = await prisma.user.create({
      data: {
        id: `ci-user-${i + 1}`,
        phone: testPhones[i],
        nom: `Test User ${i + 1}`,
        ville: pickRandom(VILLES),
        bio: `Utilisateur de test CI #${i + 1}`,
        noteMoyenne: Math.round((randomInt(30, 50) / 10) * 10) / 10,
        nbVentes: randomInt(0, 20),
        nbAchats: randomInt(0, 15),
        badgeVerifie: Math.random() > 0.5,
        fcmTokens: [],
        // Set a known OTP code so the K6 auth flow works
        otpSecret: '123456',
        otpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h validity
      },
    });
    users.push(user);

    // Générer un token JWT valide pour les tests K6
    const token = jwt.sign(
      { sub: user.id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '24h' },
    );
    tokens[testPhones[i]] = token;
  }

  // Créer des utilisateurs supplémentaires pour les annonces
  for (let i = testPhones.length; i < 50; i++) {
    const user = await prisma.user.create({
      data: {
        id: `ci-user-${i + 1}`,
        phone: generatePhone(),
        nom: `Vendeur ${i + 1}`,
        ville: pickRandom(VILLES),
        noteMoyenne: Math.round((randomInt(30, 50) / 10) * 10) / 10,
        nbVentes: randomInt(0, 50),
        nbAchats: randomInt(0, 20),
      },
    });
    users.push(user);
  }

  console.log(`  ✓ ${users.length} users created`);

  // ─── Créer des articles ─────────────────────────────────────────────────

  console.log('📦 Creating articles...');
  const articles = [];

  for (let i = 0; i < 500; i++) {
    const vendeur = users[i % users.length];
    const categorie = pickRandom(CATEGORIES);
    const titre = TITRES_ARTICLES[i % TITRES_ARTICLES.length];
    const prix = generatePrice(categorie);

    const article = await prisma.article.create({
      data: {
        vendeurId: vendeur.id,
        titre: `${titre} #${Math.floor(i / TITRES_ARTICLES.length) + 1}`,
        description: pickRandom(DESCRIPTIONS),
        categorie: categorie as any,
        etat: pickRandom(ETATS) as any,
        prix,
        ville: pickRandom(VILLES),
        statut: 'EN_LIGNE' as any,
        photos: [
          `https://picsum.photos/seed/article${i}/800/600`,
          `https://picsum.photos/seed/article${i}a/800/600`,
        ],
      },
    });
    articles.push(article);
  }

  console.log(`  ✓ ${articles.length} articles created (${articles.filter(a => a.statut === 'EN_LIGNE').length} en ligne)`);

  // ─── Créer des conversations et messages ────────────────────────────────

  console.log('💬 Creating conversations and messages...');
  const conversations: any[] = [];

  // Créer d'abord les conversations avec IDs prévisibles pour les tests K6
  for (let i = 0; i < 10; i++) {
    const acheteur = users[i % users.length];
    const vendeur = users[(i + 5) % users.length];
    const article = articles[i % articles.length];

    if (acheteur.id === vendeur.id) continue;

    try {
      const conv = await prisma.conversation.create({
        data: {
          id: `conv-loadtest-${i + 1}`,
          articleId: article.id,
          acheteurId: acheteur.id,
          vendeurId: vendeur.id,
        },
      });
      conversations.push(conv);
    } catch {
      continue;
    }
  }

  // Créer des conversations supplémentaires avec des IDs aléatoires
  for (let i = 10; i < 30; i++) {
    const acheteur = users[i % users.length];
    const vendeur = users[(i + 7) % users.length];
    const article = articles[i % articles.length];

    if (acheteur.id === vendeur.id) continue;

    try {
      const conv = await prisma.conversation.create({
        data: {
          articleId: article.id,
          acheteurId: acheteur.id,
          vendeurId: vendeur.id,
        },
      });
      conversations.push(conv);
    } catch {
      continue;
    }
  }

  // Ajouter des messages aux conversations de test K6
  const messageTexts = [
    'Bonjour, cet article est-il toujours disponible ?',
    'Oui, il est encore disponible.',
    'Super ! Puis-je passer le voir ?',
    'Bien sûr, je suis disponible ce week-end.',
    'Quel est le meilleur prix ?',
    'Je peux vous faire une remise de 10%.',
    'D\'accord, je le prends !',
    'Parfait, à bientôt !',
  ];

  for (const conv of conversations) {
    const acheteur = users.find(u => u.id === conv.acheteurId);
    const vendeur = users.find(u => u.id === conv.vendeurId);
    if (!acheteur || !vendeur) continue;

    const numMessages = randomInt(1, 8);
    for (let j = 0; j < numMessages; j++) {
      const expediteur = j % 2 === 0 ? acheteur : vendeur;
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          expediteurId: expediteur.id,
          contenu: messageTexts[j % messageTexts.length],
          type: 'TEXTE' as any,
          lu: j < numMessages - 1,
        },
      });
    }
  }

  console.log(`  ✓ ${conversations.length} conversations created`);

  // ─── Créer des transactions (pour les tests d'historique) ───────────────

  console.log('💳 Creating transactions...');
  const transactionStatuses: Array<'EN_ATTENTE' | 'BLOQUE' | 'LIBERE' | 'LITIGE' | 'REMBOURSE'> = [
    'EN_ATTENTE', 'BLOQUE', 'LIBERE', 'LITIGE', 'REMBOURSE',
  ];

  for (let i = 0; i < 20; i++) {
    const article = articles[i % articles.length];
    const acheteur = users[(i + 2) % users.length];
    const vendeur = users.find(u => u.id === article.vendeurId) || users[0];

    if (acheteur.id === vendeur.id) continue;

    const statut = pickRandom(transactionStatuses);

    await prisma.transaction.create({
      data: {
        articleId: article.id,
        acheteurId: acheteur.id,
        vendeurId: vendeur.id,
        montant: article.prix,
        fraisService: Math.round(article.prix * 0.05),
        moyenPaiement: pickRandom(['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE']),
        statutEscrow: statut,
        referencePaiement: `CI-TEST-${Date.now()}-${i}`,
        dateCreation: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000),
        dateValidation: statut === 'LIBERE' ? new Date() : null,
      },
    });
  }

  console.log('  ✓ 20 transactions created');

  // ─── Créer des favoris ──────────────────────────────────────────────────

  console.log('⭐ Creating favorites...');
  for (let i = 0; i < 100; i++) {
    const user = users[i % users.length];
    const article = articles[(i * 3) % articles.length];

    try {
      await prisma.favori.create({
        data: {
          userId: user.id,
          articleId: article.id,
        },
      });
    } catch {
      // Ignorer les doublons
    }
  }

  console.log('  ✓ 100 favorites created');

  // ─── Créer des notifications ────────────────────────────────────────────

  console.log('🔔 Creating notifications...');
  for (let i = 0; i < 50; i++) {
    const user = users[i % users.length];
    const notifTypes = ['test', 'new_message', 'payment_received', 'payment_released', 'dispute_opened'];
    const statuses = ['SENT', 'DELIVERED'];

    await prisma.notificationHistory.create({
      data: {
        userId: user.id,
        title: pickRandom([
          'Nouveau message reçu',
          'Paiement confirmé',
          'Vente réussie',
          'Litige ouvert',
          'Bienvenue sur FasoMarket',
        ]),
        body: 'Ceci est une notification de test générée par le script CI.',
        type: pickRandom(notifTypes),
        status: pickRandom(statuses),
        dateCreation: new Date(Date.now() - randomInt(0, 14) * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('  ✓ 50 notifications created');

  // ─── Exporter les tokens et IDs de conversations pour K6 ───────────────

  console.log('🔑 Exporting test tokens...');

  // Exporter les tokens dans le répertoire load-tests
  const tokenFilePath = path.join(LOAD_TEST_DIR, '.env.ci');
  const tokenContent = Object.entries(tokens)
    .map(([phone, token]) => `TOKEN_${phone.slice(-2)}=${token}`)
    .join('\n');

  // Ajouter le JWT_SECRET pour que K6 puisse vérifier (optionnel)
  const convIds = conversations
    .filter((c: any) => c.id?.startsWith('conv-loadtest'))
    .map((c: any) => c.id)
    .join(',');

  fs.writeFileSync(
    tokenFilePath,
    `# Tokens JWT pour les tests de performance K6\n` +
    `# Généré par scripts/ci-seed.ts le ${new Date().toISOString()}\n\n` +
    `${tokenContent}\n\n` +
    `# Conversation IDs pour les tests de chat\n` +
    `K6_CONVERSATION_IDS=${convIds}\n` +
    `# Token global (utilise le premier utilisateur de test)\n` +
    `JWT_TOKEN=${Object.values(tokens)[0] || ''}\n` +
    `JWT_SECRET=${JWT_SECRET}\n`,
  );

  console.log(`  ✓ Tokens exportés vers ${tokenFilePath}`);

  console.log('');
  console.log('✅ Seed completed successfully !');
  console.log(`   📊 Résumé:`);
  console.log(`      Utilisateurs:    ${users.length}`);
  console.log(`      Articles:        ${articles.length}`);
  console.log(`      Conversations:   ${conversations.length} (dont ${convIds.split(',').length} pour tests K6)`);
  console.log(`      Transactions:    20`);
  console.log(`      Favoris:         100`);
  console.log(`      Notifications:   50`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
