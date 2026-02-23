import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    roles: string[];
    activeRole: string;
    profileImageUrl?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      roles: string[];
      activeRole: string;
      profileImageUrl?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    roles: string[];
    activeRole: string;
    profileImageUrl?: string | null;
  }
}
