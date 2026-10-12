/** Who can read an article: admins see everything, employees only their own guides. */
export type HelpAudience = 'admin' | 'employee';

export type HelpCategoryId =
  | 'comecar'
  | 'ponto'
  | 'equipe'
  | 'relatorios'
  | 'documentos'
  | 'configuracoes'
  | 'colaborador'
  | 'duvidas';

export interface HelpCategory {
  id: HelpCategoryId;
  title: string;
  description: string;
}

/** Screenshot shipped with the app (see `help-images.ts`). */
export interface HelpImage {
  key: string;
  alt: string;
  caption?: string;
}

export interface HelpStep {
  title: string;
  text: string;
  image?: HelpImage;
}

export interface HelpSection {
  /** Stable anchor used by help hints: `/ajuda/<slug>?secao=<id>`. */
  id: string;
  title: string;
  paragraphs?: string[];
  steps?: HelpStep[];
  bullets?: string[];
  tip?: string;
  warning?: string;
  image?: HelpImage;
}

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategoryId;
  audience: HelpAudience[];
  /** Words people may type when searching (synonyms, everyday terms). */
  keywords: string[];
  /** Screen this article explains, opened by "Abrir esta tela". */
  screen?: { label: string; path: string };
  sections: HelpSection[];
  related?: string[];
}
