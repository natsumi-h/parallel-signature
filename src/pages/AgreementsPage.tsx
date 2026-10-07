import { ActionIcon, Badge, Group, Table, Text, Title, Tooltip } from '@mantine/core'
import { IconEye, IconRefresh } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { agreements, findUserByRole } from '../lib/data'
import { agreementStatus, formatDate, roleLabel, statusColor, statusLabel } from '../lib/format'
import { clearSignatures, useSignatures } from '../lib/signatures'
import { ROLES, type Agreement } from '../lib/types'

function AgreementRow({ agreement }: { agreement: Agreement }) {
  const navigate = useNavigate()
  const signatures = useSignatures(agreement.id)
  if (!signatures) return null
  const status = agreementStatus(signatures)

  return (
    <Table.Tr>
      <Table.Td>{agreement.title}</Table.Td>
      {ROLES.map((role) => (
        <Table.Td key={role}>
          <Text size="sm">{findUserByRole(role)?.name ?? '-'}</Text>
          <Text size="xs" c={signatures[role] ? 'green' : 'dimmed'}>
            {signatures[role] ? `Signed (${formatDate(signatures[role].signedAt)})` : 'Not signed'}
          </Text>
        </Table.Td>
      ))}
      <Table.Td>
        <Badge color={statusColor[status]} variant="light">
          {statusLabel[status]}
        </Badge>
      </Table.Td>
      <Table.Td>{formatDate(agreement.createdAt)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Tooltip label="View / Sign">
            <ActionIcon variant="light" onClick={() => navigate(`/agreements/${agreement.id}`)}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Reset signatures (demo)">
            <ActionIcon
              variant="light"
              color="red"
              disabled={status === 'awaiting_signature'}
              onClick={() => {
                if (window.confirm(`Remove all signatures from "${agreement.title}"?`)) clearSignatures(agreement.id)
              }}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}

export function AgreementsPage() {
  return (
    <>
      <Title order={3} mb="md">
        Agreements
      </Title>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            {ROLES.map((role) => (
              <Table.Th key={role}>{roleLabel[role]}</Table.Th>
            ))}
            <Table.Th>Status</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th w={120}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {agreements.map((a) => (
            <AgreementRow key={a.id} agreement={a} />
          ))}
        </Table.Tbody>
      </Table>
    </>
  )
}
