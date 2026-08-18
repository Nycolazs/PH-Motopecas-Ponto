import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './auth-types.js';
import type { ApiClient } from '../api/client.js';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}

export function useApiClient(): ApiClient {
  return useAuth().api;
}
