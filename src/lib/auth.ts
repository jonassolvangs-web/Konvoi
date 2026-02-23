import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-post', type: 'email' },
        password: { label: 'Passord', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        const roles: string[] = typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
          activeRole: user.activeRole || roles[0],
          profileImageUrl: user.profileImageUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.roles = (user as any).roles;
        token.activeRole = (user as any).activeRole;
        token.profileImageUrl = (user as any).profileImageUrl;
      }
      // Allow session.update() to change activeRole or profileImageUrl
      if (trigger === 'update' && session?.activeRole) {
        token.activeRole = session.activeRole;
      }
      if (trigger === 'update' && session?.profileImageUrl !== undefined) {
        token.profileImageUrl = session.profileImageUrl;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).roles = token.roles;
        (session.user as any).activeRole = token.activeRole;
        (session.user as any).profileImageUrl = token.profileImageUrl;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error('Ikke autentisert');
  return session;
}

export async function requireRole(...roles: string[]) {
  const session = await requireAuth();
  const activeRole = (session.user as any).activeRole;
  if (!roles.includes(activeRole)) throw new Error('Ingen tilgang');
  return session;
}
