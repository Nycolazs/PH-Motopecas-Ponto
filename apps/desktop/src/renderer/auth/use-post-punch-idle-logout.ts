import { useCallback, useEffect, useRef } from 'react';

const IDLE_TIMEOUT_MS = 10_000;
const ACTIVITY_EVENTS = [
  'click',
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'input',
];

export function usePostPunchIdleLogout(enabled: boolean, onIdle: () => void): () => void {
  const armRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let deadline: number | null = null;
    let timer: number | undefined;

    const checkDeadline = (): void => {
      window.clearTimeout(timer);
      timer = undefined;
      if (deadline === null) return;

      const remaining = deadline - Date.now();
      if (remaining > 0) {
        timer = window.setTimeout(checkDeadline, remaining);
        return;
      }

      deadline = null;
      onIdle();
    };

    const arm = (): void => {
      deadline = Date.now() + IDLE_TIMEOUT_MS;
      if (timer === undefined) checkDeadline();
    };

    const recordActivity = (): void => {
      if (deadline === null) return;
      // A suspended renderer must expire before a returning user's first interaction.
      if (Date.now() >= deadline) checkDeadline();
      else arm();
    };

    armRef.current = arm;
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { capture: true, passive: true });
    }
    window.addEventListener('focus', checkDeadline);
    document.addEventListener('visibilitychange', checkDeadline);

    return () => {
      armRef.current = null;
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity, true);
      }
      window.removeEventListener('focus', checkDeadline);
      document.removeEventListener('visibilitychange', checkDeadline);
    };
  }, [enabled, onIdle]);

  return useCallback(() => armRef.current?.(), []);
}
