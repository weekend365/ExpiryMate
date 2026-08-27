export function resolveRegisteredLandingHref(user: {
  accountType?: string | null;
  requiresEmailVerification?: boolean | null;
  email?: string | null;
}) {
  if (user.accountType !== "registered") {
    return "/auth/login" as const;
  }

  if (user.requiresEmailVerification) {
    return user.email
      ? {
          pathname: "/auth/verify-pending" as const,
          params: { email: user.email },
        }
      : ("/auth/verify-pending" as const);
  }

  return "/(tabs)/home" as const;
}
