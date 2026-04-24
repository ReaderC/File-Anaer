import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  APIError,
  fetchAuthStatus,
  login as loginRequest,
  logout as logoutRequest,
  setupAuth as setupAuthRequest,
  updateCredentials as updateCredentialsRequest
} from "../api/client";
import { releaseAllRuntimeMemory } from "../lib/runtimeMemory";

const AuthContext = createContext({
  loading: true,
  authEnabled: false,
  setupRequired: false,
  isAuthenticated: false,
  canManageCredentials: false,
  user: null,
  login: async () => {},
  setup: async () => {},
  updateCredentials: async () => {},
  logout: async () => {},
  refreshAuth: async () => {}
});

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    authEnabled: false,
    setupRequired: false,
    isAuthenticated: false,
    canManageCredentials: false,
    user: null
  });

  useEffect(() => {
    void refreshAuth(setState).catch(() => {
      setState({
        loading: false,
        authEnabled: false,
        setupRequired: false,
        isAuthenticated: false,
        canManageCredentials: false,
        user: null
      });
    });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      async login(credentials) {
        const result = await loginRequest(credentials);
        setState({
          loading: false,
          authEnabled: result.enabled,
          setupRequired: result.setupRequired,
          isAuthenticated: result.authenticated,
          canManageCredentials: result.canManageCredentials,
          user: result.user ?? null
        });
        return result;
      },
      async setup(payload) {
        const result = await setupAuthRequest(payload);
        setState({
          loading: false,
          authEnabled: result.enabled,
          setupRequired: result.setupRequired,
          isAuthenticated: result.authenticated,
          canManageCredentials: result.canManageCredentials,
          user: result.user ?? null
        });
        return result;
      },
      async updateCredentials(payload) {
        const result = await updateCredentialsRequest(payload);
        setState({
          loading: false,
          authEnabled: result.enabled,
          setupRequired: result.setupRequired,
          isAuthenticated: result.authenticated,
          canManageCredentials: result.canManageCredentials,
          user: result.user ?? null
        });
        return result;
      },
      async logout() {
        try {
          await releaseAllRuntimeMemory();
        } catch (_error) {
          // Continue logout even if runtime cleanup fails.
        }
        await logoutRequest();
        setState((current) => ({
          ...current,
          loading: false,
          setupRequired: false,
          isAuthenticated: current.authEnabled ? false : true,
          user: current.authEnabled ? null : current.user
        }));
      },
      async refreshAuth() {
        await refreshAuth(setState);
      }
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function refreshAuth(setState) {
  try {
    const result = await fetchAuthStatus();
    setState({
      loading: false,
      authEnabled: result.enabled,
      setupRequired: result.setupRequired,
      isAuthenticated: result.authenticated,
      canManageCredentials: result.canManageCredentials,
      user: result.user ?? null
    });
    return result;
  } catch (error) {
    if (error instanceof APIError && error.status === 401) {
      setState({
        loading: false,
        authEnabled: true,
        setupRequired: false,
        isAuthenticated: false,
        canManageCredentials: false,
        user: null
      });
      return null;
    }
    throw error;
  }
}

export function useAuth() {
  return useContext(AuthContext);
}
