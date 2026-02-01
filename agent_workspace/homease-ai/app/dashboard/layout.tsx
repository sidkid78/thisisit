import { SessionProvider } from '@/components/SessionHandler'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider warningMinutes={5}>
      {children}
    </SessionProvider>
  )
}
