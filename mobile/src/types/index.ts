export interface TransactionData {
  id: string;
  article: {
    id: string;
    titre: string;
    photos: string[];
    prix: number;
  };
  acheteur: { id: string; nom: string; avatar?: string };
  vendeur: { id: string; nom: string; avatar?: string };
  montant: number;
  fraisService: number;
  statutEscrow: 'EN_ATTENTE' | 'BLOQUE' | 'LIBERE' | 'LITIGE' | 'REMBOURSE';
  moyenPaiement: string;
  referencePaiement?: string;
  dateCreation: string;
  dateValidation?: string;
  dateLimite?: string;
  motifLitige?: string;
  avis?: {
    id: string;
    note: number;
    commentaire?: string;
  } | null;
}

export const STATUT_ESCROW_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  BLOQUE: 'Sécurisé (Escrow)',
  LIBERE: 'Terminée',
  LITIGE: 'Litige',
  REMBOURSE: 'Remboursée',
};

export const STATUT_ESCROW_COLORS: Record<string, string> = {
  EN_ATTENTE: '#F39C12',
  BLOQUE: '#3498DB',
  LIBERE: '#2ECC71',
  LITIGE: '#E74C3C',
  REMBOURSE: '#95A5A6',
};

export const MOYEN_PAIEMENT_LABELS: Record<string, string> = {
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
};

export interface Conversation {
  id: string;
  article: {
    id: string;
    titre: string;
    prix: number;
    photos: string[];
  };
  acheteur: { id: string; nom: string; avatar?: string };
  vendeur: { id: string; nom: string; avatar?: string };
  messages: {
    id: string;
    contenu: string;
    type: string;
    timestamp: string;
    lu: boolean;
    expediteurId: string;
  }[];
  updatedAt: string;
}
