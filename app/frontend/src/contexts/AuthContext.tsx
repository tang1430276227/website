import React, {
  createContext,
  useContext,
  ReactNode,
} from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  refetch: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Default user - no authentication required
const DEFAULT_USER: User = {
  id: 'default-user',
  email: 'user@llmgateway.com',
  name: '默认用户',
  role: 'admin',
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const value: AuthContextType = {
    user: DEFAULT_USER,
    loading: false,
    login: () => {},
    logout: () => {},
    refetch: async () => {},
    isAdmin: true,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};