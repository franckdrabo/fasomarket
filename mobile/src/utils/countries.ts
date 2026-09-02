export interface Country {
  code: string;        // Indicatif téléphonique (ex: +225)
  iso: string;         // Code ISO pays (ex: CI)
  name: string;        // Nom du pays en français
  nameEn: string;      // Nom en anglais
  flag: string;        // Emoji drapeau
  phoneLength: number; // Longueur du numéro sans l'indicatif
  phoneFormat: string; // Exemple de format
  maxLength: number;   // Longueur maximale du champ (indicatif + numéro)
}

export const SUPPORTED_COUNTRIES: Country[] = [
  {
    code: '+225',
    iso: 'CI',
    name: 'Côte d\'Ivoire',
    nameEn: 'Ivory Coast',
    flag: '🇨🇮',
    phoneLength: 10,
    phoneFormat: '01 02 03 04 05',
    maxLength: 10,
  },
  {
    code: '+226',
    iso: 'BF',
    name: 'Burkina Faso',
    nameEn: 'Burkina Faso',
    flag: '🇧🇫',
    phoneLength: 8,
    phoneFormat: '70 12 34 56',
    maxLength: 8,
  },
  {
    code: '+223',
    iso: 'ML',
    name: 'Mali',
    nameEn: 'Mali',
    flag: '🇲🇱',
    phoneLength: 8,
    phoneFormat: '70 12 34 56',
    maxLength: 8,
  },
  {
    code: '+227',
    iso: 'NE',
    name: 'Niger',
    nameEn: 'Niger',
    flag: '🇳🇪',
    phoneLength: 8,
    phoneFormat: '90 12 34 56',
    maxLength: 8,
  },
];

export const DEFAULT_COUNTRY = SUPPORTED_COUNTRIES[0]; // Côte d'Ivoire par défaut

export function getCountryByCode(code: string): Country | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code);
}


