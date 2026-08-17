import { Inject, Injectable } from '@nestjs/common';
import { instantRangeForBusinessDate } from '@ph-ponto/shared';

import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, TimePunchKind, TimePunchOrigin } from '../generated/prisma/client.js';

export interface EffectiveTimePunch {
  id: string;
  employeeId: string;
  originalOccurredAt: Date;
  effectiveOccurredAt: Date;
  kind: TimePunchKind;
  origin: TimePunchOrigin;
  createdByAdminId: string | null;
  insertionReason: string | null;
  adjustmentSequence: number;
  createdAt: Date;
}

@Injectable()
export class EffectiveTimePunchService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listForBusinessDate(
    employeeId: string,
    businessDate: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<EffectiveTimePunch[]> {
    if (transaction !== undefined) {
      return this.queryForBusinessDate(transaction, employeeId, businessDate);
    }

    return this.prisma.$transaction((client) =>
      this.queryForBusinessDate(client, employeeId, businessDate),
    );
  }

  public async findEmployeeIdForPunch(punchId: string): Promise<string | undefined> {
    const punch = await this.prisma.timePunch.findUnique({
      where: { id: punchId },
      select: { employeeId: true },
    });
    return punch?.employeeId;
  }

  private async queryForBusinessDate(
    transaction: Prisma.TransactionClient,
    employeeId: string,
    businessDate: string,
  ): Promise<EffectiveTimePunch[]> {
    const { start, endExclusive } = instantRangeForBusinessDate(businessDate);

    return transaction.$queryRaw<EffectiveTimePunch[]>`
      SELECT
        p."id",
        p."employee_id" AS "employeeId",
        p."occurred_at" AS "originalOccurredAt",
        COALESCE(latest."corrected_occurred_at", p."occurred_at") AS "effectiveOccurredAt",
        p."kind",
        p."origin",
        p."created_by_admin_id" AS "createdByAdminId",
        p."insertion_reason" AS "insertionReason",
        COALESCE(latest."sequence", 0)::integer AS "adjustmentSequence",
        p."created_at" AS "createdAt"
      FROM "time_punches" p
      LEFT JOIN LATERAL (
        SELECT a."sequence", a."corrected_occurred_at"
        FROM "time_adjustments" a
        WHERE a."time_punch_id" = p."id"
        ORDER BY a."sequence" DESC
        LIMIT 1
      ) latest ON true
      WHERE p."employee_id" = ${employeeId}::uuid
        AND p."occurred_at" >= ${start}
        AND p."occurred_at" < ${endExclusive}
      ORDER BY "effectiveOccurredAt" ASC, p."id" ASC
    `;
  }
}
