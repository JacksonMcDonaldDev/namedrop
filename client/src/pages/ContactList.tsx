import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, TextInput, SimpleGrid, Card, Image, Text, Group, Button, Stack, Skeleton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { listContacts } from '../api/contacts';
import type { Contact } from '../api/contacts';

export default function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async (query?: string) => {
    try {
      setLoading(true);
      const data = await listContacts(query);
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts(debouncedSearch || undefined);
  }, [debouncedSearch, fetchContacts]);

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Contacts</Title>
          <Button onClick={() => navigate('/contacts/new')}>Add Contact</Button>
        </Group>

        <TextInput
          placeholder="Search by name, company, or where met..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="md"
        />

        {loading ? (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {[1, 2, 3].map(i => (
              <Card key={i} shadow="sm" padding="lg" radius="md" withBorder>
                <Skeleton height={160} mb="sm" />
                <Skeleton height={20} width="70%" />
                <Skeleton height={14} width="50%" mt={6} />
              </Card>
            ))}
          </SimpleGrid>
        ) : contacts.length === 0 ? (
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Stack align="center" gap="sm">
              <Text c="dimmed" size="lg">
                {search ? 'No contacts found' : 'No contacts yet'}
              </Text>
              {!search && (
                <Button onClick={() => navigate('/contacts/new')}>Add your first contact</Button>
              )}
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {contacts.map(contact => (
              <Card
                key={contact.id}
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                {contact.photo_path ? (
                  <Card.Section>
                    <Image src={contact.photo_path} height={160} alt={contact.first_name} fit="cover" />
                  </Card.Section>
                ) : (
                  <Card.Section bg="gray.1" h={160} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text size="xl" c="dimmed">{contact.first_name[0]}{contact.last_name?.[0] || ''}</Text>
                  </Card.Section>
                )}
                <Text fw={500} mt="sm">
                  {contact.first_name} {contact.last_name || ''}
                </Text>
                {contact.company && <Text size="sm" c="dimmed">{contact.company}</Text>}
                {contact.where_met && <Text size="xs" c="dimmed">{contact.where_met}</Text>}
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
