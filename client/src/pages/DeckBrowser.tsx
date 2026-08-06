import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Text, Button, Stack, Card, Group, Skeleton, SimpleGrid, Badge } from '@mantine/core';
import { listDecks } from '../api/decks';
import type { DeckSummary } from '../api/decks';
import { tipsSeenKey } from './DeckDetail';

function DeckCard({
  deck, badge, footer, onClick,
}: {
  deck: DeckSummary;
  badge?: ReactNode;
  footer?: ReactNode;
  onClick: () => void;
}) {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600} size="lg">{deck.name}</Text>
          {badge}
        </Group>
        <Text c="dimmed" size="sm">
          {deck.person_count} {deck.person_count === 1 ? 'person' : 'people'}
        </Text>
        {footer}
      </Stack>
    </Card>
  );
}

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

  // Story 9: the technique tips only auto-open on the deck detail page, so send
  // first-timers there instead of straight into a study session.
  const handleStudyNow = (deckId: string) => {
    if (localStorage.getItem(tipsSeenKey(deckId))) {
      navigate('/study');
    } else {
      navigate(`/decks/${deckId}`);
    }
  };

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
            {decks?.map(deck => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onClick={() => navigate(`/decks/${deck.id}`)}
                badge={
                  deck.type === 'virtual' && deck.due_count > 0
                    ? <Badge color="blue">{deck.due_count} due</Badge>
                    : undefined
                }
                footer={
                  deck.type === 'virtual' ? (
                    <Button onClick={(e) => { e.stopPropagation(); handleStudyNow(deck.id); }}>Study Now</Button>
                  ) : (
                    <Text c="dimmed" size="sm">
                      {deck.accuracy !== null ? `${Math.round(deck.accuracy * 100)}% accuracy` : 'Not practiced yet'}
                      {deck.last_practiced && ` · last practiced ${new Date(deck.last_practiced).toLocaleDateString()}`}
                    </Text>
                  )
                }
              />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
