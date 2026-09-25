import { describe, expect, it } from 'vitest';
import {
  calculateDisciplinaryProgression,
  disciplineSuspensionPayloadSchema,
  disciplineVerbalPayloadSchema,
  disciplineWrittenPayloadSchema,
  type ActionForProgression,
} from './discipline.js';

describe('Disciplinary shared logic and validation', () => {
  describe('calculateDisciplinaryProgression', () => {
    const employeeId = 'd3b07384-d113-40a2-b258-000000000001';
    const employeeName = 'Carlos Alberto Souza';

    it('returns NONE stage when employee has no disciplinary actions', () => {
      const summary = calculateDisciplinaryProgression(employeeId, employeeName, []);

      expect(summary).toEqual({
        employeeId,
        employeeName,
        verbalCount: 0,
        writtenCount: 0,
        suspensionCount: 0,
        totalSuspensionDays: 0,
        voidedCount: 0,
        currentStage: 'NONE',
        lastActionDate: null,
        lastActionType: null,
        nextSuggestedStage: 'VERBAL_WARNING',
      });
    });

    it('identifies VERBAL_WARNING stage and advances suggestion to WRITTEN_WARNING', () => {
      const actions: ActionForProgression[] = [
        {
          actionType: 'VERBAL_WARNING',
          isVoid: false,
          incidentDate: '2026-09-10',
        },
      ];

      const summary = calculateDisciplinaryProgression(employeeId, employeeName, actions);

      expect(summary.verbalCount).toBe(1);
      expect(summary.writtenCount).toBe(0);
      expect(summary.suspensionCount).toBe(0);
      expect(summary.currentStage).toBe('VERBAL_WARNING');
      expect(summary.nextSuggestedStage).toBe('WRITTEN_WARNING');
      expect(summary.lastActionDate).toBe('2026-09-10');
      expect(summary.lastActionType).toBe('VERBAL_WARNING');
    });

    it('identifies WRITTEN_WARNING stage when employee has written warnings', () => {
      const actions: ActionForProgression[] = [
        {
          actionType: 'VERBAL_WARNING',
          isVoid: false,
          incidentDate: '2026-08-01',
        },
        {
          actionType: 'WRITTEN_WARNING',
          isVoid: false,
          incidentDate: '2026-08-20',
        },
      ];

      const summary = calculateDisciplinaryProgression(employeeId, employeeName, actions);

      expect(summary.verbalCount).toBe(1);
      expect(summary.writtenCount).toBe(1);
      expect(summary.suspensionCount).toBe(0);
      expect(summary.currentStage).toBe('WRITTEN_WARNING');
      expect(summary.nextSuggestedStage).toBe('SUSPENSION');
      expect(summary.lastActionDate).toBe('2026-08-20');
      expect(summary.lastActionType).toBe('WRITTEN_WARNING');
    });

    it('identifies SUSPENSION stage and tallies suspension days correctly', () => {
      const actions: ActionForProgression[] = [
        {
          actionType: 'VERBAL_WARNING',
          isVoid: false,
          incidentDate: '2026-07-01',
        },
        {
          actionType: 'WRITTEN_WARNING',
          isVoid: false,
          incidentDate: '2026-07-20',
        },
        {
          actionType: 'SUSPENSION',
          isVoid: false,
          incidentDate: '2026-08-15',
          suspensionDays: 2,
        },
        {
          actionType: 'SUSPENSION',
          isVoid: false,
          incidentDate: '2026-09-05',
          suspensionDays: 3,
        },
      ];

      const summary = calculateDisciplinaryProgression(employeeId, employeeName, actions);

      expect(summary.verbalCount).toBe(1);
      expect(summary.writtenCount).toBe(1);
      expect(summary.suspensionCount).toBe(2);
      expect(summary.totalSuspensionDays).toBe(5);
      expect(summary.currentStage).toBe('SUSPENSION');
      expect(summary.nextSuggestedStage).toBe('DISMISSAL_REVIEW');
      expect(summary.lastActionDate).toBe('2026-09-05');
      expect(summary.lastActionType).toBe('SUSPENSION');
    });

    it('strictly excludes voided actions from active progression counts and active stage determination', () => {
      const actions: ActionForProgression[] = [
        {
          actionType: 'VERBAL_WARNING',
          isVoid: true, // voided!
          incidentDate: '2026-06-01',
        },
        {
          actionType: 'WRITTEN_WARNING',
          isVoid: true, // voided!
          incidentDate: '2026-07-01',
        },
        {
          actionType: 'SUSPENSION',
          isVoid: true, // voided!
          incidentDate: '2026-08-01',
          suspensionDays: 5,
        },
        {
          actionType: 'VERBAL_WARNING',
          isVoid: false, // only this one is active
          incidentDate: '2026-09-01',
        },
      ];

      const summary = calculateDisciplinaryProgression(employeeId, employeeName, actions);

      expect(summary.verbalCount).toBe(1);
      expect(summary.writtenCount).toBe(0);
      expect(summary.suspensionCount).toBe(0);
      expect(summary.totalSuspensionDays).toBe(0);
      expect(summary.voidedCount).toBe(3);
      expect(summary.currentStage).toBe('VERBAL_WARNING');
      expect(summary.nextSuggestedStage).toBe('WRITTEN_WARNING');
      expect(summary.lastActionDate).toBe('2026-09-01');
      expect(summary.lastActionType).toBe('VERBAL_WARNING');
    });

    it('returns NONE when ALL actions are voided', () => {
      const actions: ActionForProgression[] = [
        {
          actionType: 'VERBAL_WARNING',
          isVoid: true,
          incidentDate: '2026-08-01',
        },
        {
          actionType: 'SUSPENSION',
          isVoid: true,
          incidentDate: '2026-08-10',
          suspensionDays: 3,
        },
      ];

      const summary = calculateDisciplinaryProgression(employeeId, employeeName, actions);

      expect(summary.verbalCount).toBe(0);
      expect(summary.writtenCount).toBe(0);
      expect(summary.suspensionCount).toBe(0);
      expect(summary.totalSuspensionDays).toBe(0);
      expect(summary.voidedCount).toBe(2);
      expect(summary.currentStage).toBe('NONE');
      expect(summary.lastActionDate).toBeNull();
      expect(summary.lastActionType).toBeNull();
      expect(summary.nextSuggestedStage).toBe('VERBAL_WARNING');
    });
  });

  describe('Schemas validation', () => {
    it('validates a valid verbal warning payload', () => {
      const valid = {
        employeeId: 'd3b07384-d113-40a2-b258-000000000001',
        employeeName: 'João da Silva',
        employeeCpf: '123.456.789-00',
        employeeRole: 'Mecânico de Motos',
        incidentDate: '2026-09-20',
        location: 'Oficina Central',
        reason: 'Atraso reiterado no início do expediente',
        details:
          'O colaborador apresentou atrasos sucessivos nos dias 18 e 19 de setembro sem justificativa. Foi orientado formalmente.',
        internalClauseRef: 'Artigo 4º do Regimento Interno',
        commitment: 'Comprometeu-se a pontualidade rigorosa a partir de 21/09.',
        witnesses: [{ name: 'Maria Souza', cpf: '000.111.222-33' }],
      };

      const result = disciplineVerbalPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects verbal warning with too short details', () => {
      const invalid = {
        employeeId: 'd3b07384-d113-40a2-b258-000000000001',
        employeeName: 'João da Silva',
        incidentDate: '2026-09-20',
        reason: 'Atraso',
        details: 'Curto', // < 10 chars
      };

      const result = disciplineVerbalPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates a valid written warning payload', () => {
      const valid = {
        employeeId: 'd3b07384-d113-40a2-b258-000000000001',
        employeeName: 'João da Silva',
        employeeCpf: '123.456.789-00',
        employeeRole: 'Mecânico de Motos',
        incidentDate: '2026-09-22',
        reason: 'Desídia no desempenho das funções',
        details:
          'Após advertência verbal em 20/09, o colaborador voltou a descumprir o uso de EPIs obrigatórios.',
        internalClauseRef: 'Artigo 12 do Regimento Interno',
        legalBasisRef: 'Artigo 482, alínea e da CLT',
        consequencesNote:
          'A reincidência acarretará a aplicação de suspensão disciplinar ou demissão por justa causa.',
        witnesses: [],
      };

      const result = disciplineWrittenPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('enforces suspensionDays bounds (1 to 30 days) under CLT Art. 474', () => {
      const base = {
        employeeId: 'd3b07384-d113-40a2-b258-000000000001',
        employeeName: 'João da Silva',
        incidentDate: '2026-09-24',
        suspensionStartDate: '2026-09-25',
        suspensionEndDate: '2026-09-27',
        returnDate: '2026-09-28',
        reason: 'Falta injustificada e reincidência em desobediência',
        details:
          'Suspensão disciplinar de 3 dias em virtude de reiterada inobservância às ordens da chefia.',
      };

      expect(
        disciplineSuspensionPayloadSchema.safeParse({ ...base, suspensionDays: 3 }).success,
      ).toBe(true);
      expect(
        disciplineSuspensionPayloadSchema.safeParse({ ...base, suspensionDays: 0 }).success,
      ).toBe(false);
      expect(
        disciplineSuspensionPayloadSchema.safeParse({ ...base, suspensionDays: 31 }).success,
      ).toBe(false);
    });
  });
});
