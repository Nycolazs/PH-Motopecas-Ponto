import { describe, expect, it } from 'vitest';
import {
  CANONICAL_PERFORMANCE_CRITERIA,
  calculatePerformanceMean,
  performanceReviewPayloadSchema,
  supersedePerformanceReviewSchema,
} from './performance.js';

describe('Performance Domain Logic', () => {
  describe('CANONICAL_PERFORMANCE_CRITERIA', () => {
    it('defines exactly 8 canonical criteria with distinct keys and orders 1 to 8', () => {
      expect(CANONICAL_PERFORMANCE_CRITERIA).toHaveLength(8);
      const keys = new Set(CANONICAL_PERFORMANCE_CRITERIA.map((c) => c.key));
      expect(keys.size).toBe(8);
      const orders = CANONICAL_PERFORMANCE_CRITERIA.map((c) => c.order);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe('calculatePerformanceMean', () => {
    it('calculates mean score 5.00 and classifies as EXCELLENT', () => {
      const scores = Array(8).fill({ score: 5 });
      const result = calculatePerformanceMean(scores);
      expect(result.meanScore).toBe(5);
      expect(result.classification).toBe('EXCELLENT');
      expect(result.totalPoints).toBe(40);
      expect(result.criteriaCount).toBe(8);
    });

    it('calculates mean score 1.00 and classifies as NEEDS_IMPROVEMENT', () => {
      const scores = Array(8).fill({ score: 1 });
      const result = calculatePerformanceMean(scores);
      expect(result.meanScore).toBe(1);
      expect(result.classification).toBe('NEEDS_IMPROVEMENT');
      expect(result.totalPoints).toBe(8);
    });

    it('rounds deterministically to two decimal places (e.g. 33 / 8 = 4.125 -> 4.13)', () => {
      // 5, 5, 5, 4, 4, 4, 4, 4 = 35 -> 35/8 = 4.375 -> 4.38
      // 5, 4, 4, 4, 4, 4, 4, 4 = 33 -> 33/8 = 4.125 -> 4.13
      const scores = [
        { score: 5 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
      ];
      const result = calculatePerformanceMean(scores);
      expect(result.totalPoints).toBe(33);
      expect(result.meanScore).toBe(4.13);
      expect(result.classification).toBe('GOOD');
    });

    it('classifies 4.50 as EXCELLENT and 4.49 as GOOD', () => {
      // 36 / 8 = 4.50 -> EXCELLENT
      const scores36 = [
        { score: 5 },
        { score: 5 },
        { score: 5 },
        { score: 5 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
      ];
      expect(calculatePerformanceMean(scores36).meanScore).toBe(4.5);
      expect(calculatePerformanceMean(scores36).classification).toBe('EXCELLENT');

      // 4.38 -> GOOD
      const scores35 = [
        { score: 5 },
        { score: 5 },
        { score: 5 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
        { score: 4 },
      ];
      expect(calculatePerformanceMean(scores35).meanScore).toBe(4.38);
      expect(calculatePerformanceMean(scores35).classification).toBe('GOOD');
    });

    it('classifies 3.50 as GOOD and 3.49 as REGULAR', () => {
      // 28 / 8 = 3.50 -> GOOD
      const scores28 = Array(4)
        .fill({ score: 4 })
        .concat(Array(4).fill({ score: 3 }));
      expect(calculatePerformanceMean(scores28).meanScore).toBe(3.5);
      expect(calculatePerformanceMean(scores28).classification).toBe('GOOD');

      // 27 / 8 = 3.375 -> 3.38 -> REGULAR
      const scores27 = Array(3)
        .fill({ score: 4 })
        .concat(Array(5).fill({ score: 3 }));
      expect(calculatePerformanceMean(scores27).meanScore).toBe(3.38);
      expect(calculatePerformanceMean(scores27).classification).toBe('REGULAR');
    });

    it('classifies 2.50 as REGULAR and 2.49 as NEEDS_IMPROVEMENT', () => {
      // 20 / 8 = 2.50 -> REGULAR
      const scores20 = Array(4)
        .fill({ score: 3 })
        .concat(Array(4).fill({ score: 2 }));
      expect(calculatePerformanceMean(scores20).meanScore).toBe(2.5);
      expect(calculatePerformanceMean(scores20).classification).toBe('REGULAR');

      // 19 / 8 = 2.375 -> 2.38 -> NEEDS_IMPROVEMENT
      const scores19 = Array(3)
        .fill({ score: 3 })
        .concat(Array(5).fill({ score: 2 }));
      expect(calculatePerformanceMean(scores19).meanScore).toBe(2.38);
      expect(calculatePerformanceMean(scores19).classification).toBe('NEEDS_IMPROVEMENT');
    });

    it('throws error for empty list', () => {
      expect(() => calculatePerformanceMean([])).toThrow(/vazia/i);
    });

    it('throws error for score below 1', () => {
      expect(() => calculatePerformanceMean([{ score: 0 }])).toThrow(/inválida/i);
    });

    it('throws error for score above 5', () => {
      expect(() => calculatePerformanceMean([{ score: 6 }])).toThrow(/inválida/i);
    });

    it('throws error for non-integer score', () => {
      expect(() => calculatePerformanceMean([{ score: 3.5 }])).toThrow(/inteiros/i);
    });
  });

  describe('performanceReviewPayloadSchema', () => {
    const validScores = CANONICAL_PERFORMANCE_CRITERIA.map((c) => ({
      criterionKey: c.key,
      criterionTitle: c.title,
      score: 4,
      feedback: 'Bom desempenho neste critério.',
    }));

    const validPayload = {
      employeeId: '11111111-1111-4111-8111-111111111111',
      employeeName: 'João da Silva',
      employeeCpf: '123.456.789-00',
      employeeRole: 'Mecânico de Motocicletas',
      evaluationPeriod: '2026 - 3º Trimestre',
      evaluationDate: '2026-09-25',
      evaluatorId: '22222222-2222-4222-8222-222222222222',
      evaluatorName: 'Gestor Responsável',
      evaluatorRole: 'Gerente Geral',
      criteriaScores: validScores,
      strengths: 'Comprometimento e agilidade no diagnóstico de panes elétricas.',
      improvements: 'Organização do ferramental ao término do expediente.',
      actionPlan: 'Manter checklist de ferramentas e participar do treinamento avançado.',
      evaluatorComments: 'Excelente evolução neste trimestre.',
      employeeComments: 'Concordo com os pontos levantados e buscarei melhorar.',
    };

    it('validates a complete and correct evaluation payload', () => {
      const parsed = performanceReviewPayloadSchema.parse(validPayload);
      expect(parsed.criteriaScores).toHaveLength(8);
      expect(parsed.employeeName).toBe('João da Silva');
    });

    it('rejects payload with fewer than 8 criteria', () => {
      const invalid = { ...validPayload, criteriaScores: validScores.slice(0, 7) };
      expect(() => performanceReviewPayloadSchema.parse(invalid)).toThrow(
        /exatamente os 8 critérios/i,
      );
    });

    it('rejects payload with more than 8 criteria', () => {
      const invalid = {
        ...validPayload,
        criteriaScores: [
          ...validScores,
          { criterionKey: 'EXTRA', criterionTitle: 'Extra', score: 3 },
        ],
      };
      expect(() => performanceReviewPayloadSchema.parse(invalid)).toThrow(
        /exatamente os 8 critérios/i,
      );
    });

    it('rejects payload with invalid score within criteria', () => {
      const invalidScores = [...validScores];
      invalidScores[0] = { ...invalidScores[0]!, score: 0 };
      const invalid = { ...validPayload, criteriaScores: invalidScores };
      expect(() => performanceReviewPayloadSchema.parse(invalid)).toThrow(/mínima/i);
    });
  });

  describe('supersedePerformanceReviewSchema', () => {
    it('validates valid supersession reason', () => {
      const valid = supersedePerformanceReviewSchema.parse({
        reason: 'Correção de nota no critério de pontualidade após reconsideração de atestado.',
      });
      expect(valid.reason).toContain('Correção');
    });

    it('rejects reason shorter than 5 characters', () => {
      expect(() => supersedePerformanceReviewSchema.parse({ reason: 'abc' })).toThrow(/mínimo 5/i);
    });
  });
});
