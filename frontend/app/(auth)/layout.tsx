/**
 * Auth layout — hides sidebar/mobile nav on login/signup pages.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
