import type { DocumentTypeDto } from '../api/contracts.js';

export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeDto, string> = {
  CULTURE: 'Cultura Organizacional',
  REGULATION: 'Regimento Interno',
  ROLE_MAP: 'Descrição de Cargo',
  INTERVIEW: 'Entrevista de Contratação',
  ACKNOWLEDGMENT_REGULATION: 'Ciência de Regimento',
  ACKNOWLEDGMENT_ROLE: 'Ciência de Cargo',
  DISCIPLINE_VERBAL: 'Advertência Verbal',
  DISCIPLINE_WRITTEN: 'Advertência Escrita',
  DISCIPLINE_SUSPENSION: 'Suspensão Disciplinar',
  PERFORMANCE_REVIEW: 'Avaliação de Desempenho',
};
