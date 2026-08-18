import { COMPANY_NAME, PRODUCT_NAME } from '@ph-ponto/shared';
import logoUrl from '../assets/phmotos-logo.png';
import iconUrl from '../assets/app-icon.png';

interface BrandProps {
  compact?: boolean;
  showIconOnly?: boolean;
  className?: string;
}

export function Brand({
  compact = false,
  showIconOnly = false,
  className = '',
}: BrandProps): React.JSX.Element {
  if (showIconOnly) {
    return (
      <div
        className={`flex items-center gap-2.5 ${className}`}
        aria-label={`${PRODUCT_NAME}, ${COMPANY_NAME}`}
      >
        <img
          src={iconUrl}
          alt="PH Motopeças"
          className="w-9 h-9 rounded-lg object-contain shrink-0 shadow-2xs"
        />
        <div className="flex flex-col">
          <strong className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            {PRODUCT_NAME}
          </strong>
          <small className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            {COMPANY_NAME}
          </small>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`brand flex items-center ${compact ? 'compact' : ''} ${className}`}
      aria-label={`${PRODUCT_NAME}, ${COMPANY_NAME}`}
    >
      <img
        src={logoUrl}
        alt="PH Motopeças"
        className={
          compact
            ? 'h-8 max-w-[190px] object-contain shrink-0 filter drop-shadow-xs'
            : 'h-11 max-w-[240px] object-contain shrink-0 filter drop-shadow-xs'
        }
      />
    </div>
  );
}
