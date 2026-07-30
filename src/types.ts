export interface Modifier {
  name: string;
  percent: number;
}

export interface Trait {
  name: string;
  englishName: string;
  basePoints: number;
  details: string;
  modifiers: Modifier[];
  finalPoints: number;
}

export interface Mutation {
  id?: string; // local UI identifier
  name: string;
  theme: string;
  bodySystem?: string; // Target body system / part
  description: string;
  advantages: Trait[];
  disadvantages: Trait[];
  totalPositivePoints: number;
  totalNegativePoints: number;
  netPoints: number;
  imageUrl?: string; // Base64 or URL of generated portrait
}

export interface Character {
  name: string;
  mutations: Mutation[];
}
