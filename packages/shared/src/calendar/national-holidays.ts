/** A Brazilian national holiday on a given business date (YYYY-MM-DD). */
export interface NationalHoliday {
  businessDate: string;
  name: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Easter Sunday (Gregorian computus, Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function shift(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

/**
 * Feriados nacionais (Leis 662/1949, 6.802/1980 e 14.759/2023) plus Sexta-feira da Paixão.
 * Carnaval and Corpus Christi are "ponto facultativo" nationally and are left out; state and
 * city holidays are registered by each company.
 */
export function brazilianNationalHolidays(year: number): NationalHoliday[] {
  const fixed: Array<[string, string]> = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
    ['12-25', 'Natal'],
  ];
  const holidays = fixed.map(([monthDay, name]) => ({ businessDate: `${year}-${monthDay}`, name }));
  holidays.push({ businessDate: shift(easterSunday(year), -2), name: 'Sexta-feira da Paixão' });
  return holidays.sort((left, right) => left.businessDate.localeCompare(right.businessDate));
}

/** National holidays from `from` (inclusive) to `to` (inclusive). */
export function nationalHolidaysBetween(from: string, to: string): NationalHoliday[] {
  const result: NationalHoliday[] = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    for (const holiday of brazilianNationalHolidays(year)) {
      if (holiday.businessDate >= from && holiday.businessDate <= to) result.push(holiday);
    }
  }
  return result;
}
