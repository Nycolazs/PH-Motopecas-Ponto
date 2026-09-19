import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePostPunchIdleLogout } from './use-post-punch-idle-logout.js';

describe('post-punch inactivity', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts only after a confirmed punch and expires exactly after ten idle seconds', () => {
    const logout = vi.fn();
    const { result } = renderHook(() => usePostPunchIdleLogout(true, logout));

    act(() => vi.advanceTimersByTime(30_000));
    expect(logout).not.toHaveBeenCalled();

    act(() => result.current());
    act(() => vi.advanceTimersByTime(9_999));
    expect(logout).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(logout).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(30_000));
    expect(logout).toHaveBeenCalledOnce();
  });

  it.each(['click', 'pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'input'])(
    'restarts the idle interval on %s, including inside a modal that stops propagation',
    (eventName) => {
      const logout = vi.fn();
      const { result } = renderHook(() => usePostPunchIdleLogout(true, logout));
      const input = document.createElement('input');
      input.addEventListener(eventName, (event) => event.stopPropagation());
      document.body.append(input);

      act(() => result.current());
      act(() => vi.advanceTimersByTime(9_000));
      act(() => input.dispatchEvent(new Event(eventName, { bubbles: true })));
      act(() => vi.advanceTimersByTime(9_999));
      expect(logout).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(logout).toHaveBeenCalledOnce();
      input.remove();
    },
  );

  it('does not count rerenders, focus, visibility, or network events as user activity', () => {
    const logout = vi.fn();
    const { result, rerender } = renderHook(() => usePostPunchIdleLogout(true, logout));
    act(() => result.current());
    act(() => vi.advanceTimersByTime(9_000));
    rerender();
    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => vi.advanceTimersByTime(1_000));
    expect(logout).toHaveBeenCalledOnce();
  });

  it.each(['focus', 'visibilitychange', 'pointerdown'])(
    'expires on %s after suspension instead of extending an elapsed deadline',
    (eventName) => {
      const logout = vi.fn();
      const { result } = renderHook(() => usePostPunchIdleLogout(true, logout));
      act(() => result.current());
      vi.setSystemTime(Date.now() + 60_000);
      act(() => {
        const target = eventName === 'visibilitychange' ? document : window;
        target.dispatchEvent(new Event(eventName));
      });
      expect(logout).toHaveBeenCalledOnce();
    },
  );

  it('restarts the interval after another confirmed punch', () => {
    const logout = vi.fn();
    const { result } = renderHook(() => usePostPunchIdleLogout(true, logout));
    act(() => result.current());
    act(() => vi.advanceTimersByTime(8_000));
    act(() => result.current());
    act(() => vi.advanceTimersByTime(9_999));
    expect(logout).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('does not arm when disabled and forgets the deadline when the session ends', () => {
    const logout = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) => usePostPunchIdleLogout(enabled, logout),
      { initialProps: { enabled: false } },
    );
    act(() => result.current());
    act(() => vi.advanceTimersByTime(30_000));
    expect(logout).not.toHaveBeenCalled();

    rerender({ enabled: true });
    act(() => result.current());
    act(() => vi.advanceTimersByTime(9_000));
    rerender({ enabled: false });
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(30_000));
    expect(logout).not.toHaveBeenCalled();
  });

  it('removes timers and listeners on unmount, including late punch responses', () => {
    const logout = vi.fn();
    const { result, unmount } = renderHook(() => usePostPunchIdleLogout(true, logout));
    const confirmPunch = result.current;
    act(() => confirmPunch());
    unmount();
    act(() => {
      confirmPunch();
      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(30_000);
    });
    expect(logout).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
