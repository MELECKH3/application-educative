import { createFileRoute, Outlet } from '@tanstack/react-router'
import { getBilling } from '@/lib/billing.functions'
import { requireStudent } from '@/lib/require-student'
import { AppShell } from '@/components/app/app-shell'

export const Route = createFileRoute('/_app')({
  beforeLoad: requireStudent,
  loader: () => getBilling(),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
