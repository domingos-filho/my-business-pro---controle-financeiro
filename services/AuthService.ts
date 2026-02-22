
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider?: 'email' | 'google' | 'apple';
}

export const AuthService = {
  // Simula login tradicional
  async loginWithEmail(email: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const user: User = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      email: email,
      name: email.split('@')[0],
      avatar: `https://ui-avatars.com/api/?name=${email}&background=6366f1&color=fff`,
      provider: 'email'
    };
    localStorage.setItem('auth_session', JSON.stringify(user));
    return user;
  },

  // Simula login social
  async loginWithSocial(provider: 'google' | 'apple'): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const user: User = {
      id: `usr_${provider}_` + Math.random().toString(36).substr(2, 9),
      email: `${provider}@exemplo.com`,
      name: provider === 'google' ? 'Google User' : 'Apple User',
      avatar: provider === 'google' 
        ? 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png'
        : 'https://cdn-icons-png.flaticon.com/512/0/747.png',
      provider: provider
    };
    localStorage.setItem('auth_session', JSON.stringify(user));
    return user;
  },

  // Simula registro
  async register(name: string, email: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const user: User = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      email: email,
      name: name,
      avatar: `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff`,
      provider: 'email'
    };
    localStorage.setItem('auth_session', JSON.stringify(user));
    return user;
  },

  async logout() {
    localStorage.removeItem('auth_session');
    // Removido o reload para evitar falhas em ambientes de preview
  },

  getCurrentUser(): User | null {
    const session = localStorage.getItem('auth_session');
    return session ? JSON.parse(session) : null;
  }
};
