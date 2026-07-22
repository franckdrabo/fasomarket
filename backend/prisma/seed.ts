import { PrismaClient, Categorie, EtatArticle, StatutArticle } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean database
  await prisma.avis.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.article.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const cartman = await prisma.user.create({
    data: {
      phone: '+2250101020304',
      nom: 'Cartman',
      ville: 'Abidjan',
      bio: 'Fondateur de Bazario',
      badgeVerifie: true,
    },
  });

  const alice = await prisma.user.create({
    data: {
      phone: '+2250102030405',
      nom: 'Alice Kouamé',
      ville: 'Abidjan',
      noteMoyenne: 4.8,
      nbVentes: 12,
    },
  });

  const bob = await prisma.user.create({
    data: {
      phone: '+2250103040506',
      nom: 'Bob Traoré',
      ville: 'Dakar',
      noteMoyenne: 4.5,
      nbVentes: 8,
    },
  });

  // Create articles
  await prisma.article.create({
    data: {
      vendeurId: alice.id,
      titre: 'Robe africaine wax - Taille M',
      description: 'Superbe robe en wax africaine, portée une seule fois. Couleurs vives, idéale pour les cérémonies.',
      categorie: Categorie.VETEMENTS,
      etat: EtatArticle.COMME_NEUF,
      prix: 15000,
      ville: 'Abidjan',
      photos: ['https://res.cloudinary.com/demo/image/upload/v1/bazario/sample'],
      statut: StatutArticle.EN_LIGNE,
    },
  });

  await prisma.article.create({
    data: {
      vendeurId: bob.id,
      titre: 'iPhone 13 Pro - 256 Go',
      description: 'iPhone 13 Pro gris sidéral, parfait état. Débloqué tous opérateurs. Chargeur et coque inclus.',
      categorie: Categorie.ELECTRONIQUE,
      etat: EtatArticle.BON_ETAT,
      prix: 450000,
      ville: 'Dakar',
      photos: ['https://res.cloudinary.com/demo/image/upload/v1/bazario/sample'],
      statut: StatutArticle.EN_LIGNE,
    },
  });

  await prisma.article.create({
    data: {
      vendeurId: alice.id,
      titre: 'Canapé 3 places en tissu',
      description: 'Canapé confortable, couleur beige. Légères traces d\'usage mais très bon état général.',
      categorie: Categorie.MAISON,
      etat: EtatArticle.BON_ETAT,
      prix: 85000,
      ville: 'Abidjan',
      photos: ['https://res.cloudinary.com/demo/image/upload/v1/bazario/sample'],
      statut: StatutArticle.EN_LIGNE,
    },
  });

  console.log('✅ Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
