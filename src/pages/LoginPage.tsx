import { Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { users } from '../lib/data'
import { roleLabel } from '../lib/format'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/agreements" replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    try {
      login(username, password)
      navigate('/agreements')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Center h="100dvh" bg="gray.0">
      <Paper withBorder shadow="sm" p="xl" w={380}>
        <form onSubmit={onSubmit}>
          <Stack>
            <Title order={3}>Log in</Title>
            <TextInput
              label="Username"
              placeholder="seller / buyer"
              required
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
            />
            <PasswordInput
              label="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
            <Button type="submit">Log in</Button>
            <Text size="xs" c="dimmed">
              Demo accounts (username / password):
              {users.map((u) => ` ${roleLabel[u.role]} ${u.username} / ${u.password}`).join(',')}
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
