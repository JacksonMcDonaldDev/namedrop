import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Text, Button, Stack, Card, Group, Skeleton, SimpleGrid, Badge } from '@mantine/core';
import { listDecks } from '../api/decks';
import type { DeckSummary } from '../api/decks';

export default function DeckBrowser() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDecks()
      .then(setDecks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>namedrop</Title>
          <Text c="dimmed">Pick a deck to practice.</Text>
        </div>

        {loading ? (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Skeleton height={150} radius="md" />
            <Skeleton height={150} radius="md" />
          </SimpleGrid>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {decks?.map(deck =>
              deck.type === 'virtual' ? (
                <Card key={deck.id} shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={600} size="lg">{deck.name}</Text>
                      {deck.due_count > 0 && <Badge color="blue">{deck.due_count} due</Badge>}
                    </Group>
                    <Text c="dimmed" size="sm">
                      {deck.person_count} {deck.person_count === 1 ? 'person' : 'people'}
                    </Text>
                    <Button onClick={() => navigate('/study')}>Study Now</Button>
                  </Stack>
                </Card>
              ) : (
                <Card key={deck.id} shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="sm">
                    <Text fw={600} size="lg">{deck.name}</Text>
                    <Text c="dimmed" size="sm">
                      {deck.person_count} {deck.person_count === 1 ? 'person' : 'people'}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {deck.accuracy !== null ? `${deck.accuracy}% accuracy` : 'Not practiced yet'}
                    </Text>
                  </Stack>
                </Card>
              )
            )}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
