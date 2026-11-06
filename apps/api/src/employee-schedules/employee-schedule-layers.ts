import type {
  EmployeeScheduleOverrideInput,
  EmployeeScheduleVersionInput,
  Weekday,
} from '@ph-ponto/shared';

import type { Prisma } from '../generated/prisma/client.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
} from '../schedules/business-date.js';

export interface EmployeeScheduleLayer {
  versions: EmployeeScheduleVersionInput[];
  overrides: EmployeeScheduleOverrideInput[];
}

export const EMPTY_SCHEDULE_LAYER: EmployeeScheduleLayer = Object.freeze({
  versions: [],
  overrides: [],
}) as EmployeeScheduleLayer;

const versionSelect = {
  id: true,
  employeeId: true,
  effectiveDate: true,
  usesCompanySchedule: true,
  cycleWeeks: true,
  cycleAnchorDate: true,
  days: {
    select: {
      cycleWeek: true,
      weekday: true,
      isWorkday: true,
      startMinute: true,
      endMinute: true,
      breakStartMinute: true,
      breakEndMinute: true,
    },
  },
} satisfies Prisma.EmployeeScheduleVersionSelect;

type VersionRecord = Prisma.EmployeeScheduleVersionGetPayload<{ select: typeof versionSelect }>;

export function toVersionInput(record: VersionRecord): EmployeeScheduleVersionInput {
  return {
    id: record.id,
    effectiveDate: databaseDateToBusinessDate(record.effectiveDate),
    usesCompanySchedule: record.usesCompanySchedule,
    cycleWeeks: record.cycleWeeks,
    cycleAnchorDate: databaseDateToBusinessDate(record.cycleAnchorDate),
    days: record.days.map((day) => ({ ...day, weekday: day.weekday as Weekday })),
  };
}

/**
 * Loads each employee's escala versions effective up to `to` and the active one-day
 * overrides between `from` and `to`. Employees without either get the empty layer.
 */
export async function loadEmployeeScheduleLayers(
  transaction: Prisma.TransactionClient,
  employeeIds: readonly string[],
  from: string,
  to: string,
): Promise<Map<string, EmployeeScheduleLayer>> {
  const layers = new Map<string, EmployeeScheduleLayer>();
  if (employeeIds.length === 0) return layers;

  const [versions, overrides] = await Promise.all([
    transaction.employeeScheduleVersion.findMany({
      where: {
        employeeId: { in: [...employeeIds] },
        effectiveDate: { lte: businessDateToDatabaseDate(to) },
      },
      orderBy: { effectiveDate: 'asc' },
      select: versionSelect,
    }),
    transaction.scheduleOverride.findMany({
      where: {
        employeeId: { in: [...employeeIds] },
        revokedAt: null,
        businessDate: {
          gte: businessDateToDatabaseDate(from),
          lte: businessDateToDatabaseDate(to),
        },
      },
      select: {
        id: true,
        employeeId: true,
        businessDate: true,
        isWorkday: true,
        startMinute: true,
        endMinute: true,
        breakStartMinute: true,
        breakEndMinute: true,
        reason: true,
        note: true,
      },
    }),
  ]);

  const layerFor = (employeeId: string): EmployeeScheduleLayer => {
    let layer = layers.get(employeeId);
    if (layer === undefined) {
      layer = { versions: [], overrides: [] };
      layers.set(employeeId, layer);
    }
    return layer;
  };

  for (const version of versions) {
    layerFor(version.employeeId).versions.push(toVersionInput(version));
  }
  for (const override of overrides) {
    layerFor(override.employeeId).overrides.push({
      id: override.id,
      businessDate: databaseDateToBusinessDate(override.businessDate),
      isWorkday: override.isWorkday,
      startMinute: override.startMinute,
      endMinute: override.endMinute,
      breakStartMinute: override.breakStartMinute,
      breakEndMinute: override.breakEndMinute,
      reason: override.reason,
      note: override.note,
    });
  }
  return layers;
}

export { versionSelect as employeeScheduleVersionSelect };
