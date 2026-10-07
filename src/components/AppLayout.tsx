import { AppShell, Badge, Group, NavLink, Stack, Text, Title } from '@mantine/core'
import { IconLogout, IconSignature } from '@tabler/icons-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { roleLabel } from '../lib/format'

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 0 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Parallel Signature Demo</Title>
          {user && (
            <Group gap="xs">
              <Badge variant="light" color={user.role === 'seller' ? 'grape' : 'teal'}>
                {roleLabel[user.role]}
              </Badge>
              <Text size="sm">
                {user.name} ({user.company})
              </Text>
            </Group>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Stack gap={4} h="100%">
          <NavLink
            component={Link}
            to="/agreements"
            label="Agreements"
            leftSection={<IconSignature size={18} />}
            active={location.pathname.startsWith('/agreements')}
          />
          <NavLink
            mt="auto"
            label="Log out"
            leftSection={<IconLogout size={18} />}
            onClick={() => {
              logout()
              navigate('/login')
            }}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
