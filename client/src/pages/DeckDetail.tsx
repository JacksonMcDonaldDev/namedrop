import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, Text, Button, Stack, Card, Group, Skeleton,
  SimpleGrid, Badge, Modal, Avatar, List,
} from '@mantine/core';
import { getDeckDetail } from '../api/decks';
import type { DeckDetail as DeckDetailData } from '../api/decks';

const TECHNIQUE_TIPS = [
  {
    title: 'Face-feature association',
    body: 'Pick one distinctive facial feature — eyebrows, jawline, hairline — and link it to the name in your mind.',
  },
  {
    title: 'Name elaboration',
    body: 'Turn the name into a short phrase or mini-rhyme so it has more than one hook to latch onto.',
  },
  {
    title: 'Immediate use',
    body: 'Say the name out loud within seconds of seeing it — active use cements it far better than passive reading.',
  },
  {
    title: 'Build a quick story',
    body: 'Connect the name to something memorable about the face or context in a one-sentence mental story.',
  },
  {
    title: 'Repeat on a delay',
    body: "Come back a few minutes later and try to recall the name before looking — the struggle is what makes it stick.",
  },
];

function tipsSeenKey(deckId: string) {
  return `namedrop:tipsSeen:${deckId}`;
}

export default function DeckDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchDeck(deckId: string) {
      setLoading(true);
      try {
        const data = await getDeckDetail(deckId);
        setDeck(data);
        if (!localStorage.getItem(tipsSeenKey(deckId))) {
          setTipsOpen(true);
          localStorage.setItem(tipsSeenKey(deckId), 'true');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load deck');
      } finally {
        setLoading(false);
      }
    }

    fetchDeck(id);
  }, [id]);

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Stack gap="lg">
          <Skeleton height={40} width="40%" />
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height={120} radius="md" />)}
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  if (error || !deck) {
    return (
      <Container size="md" py="xl">
        <Stack gap="md" align="center">
          <Text c="dimmed">{error || 'Deck not found'}</Text>
          <Button variant="light" onClick={() => navigate('/')}>Back to Decks</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>{deck.name}</Title>
            <Text c="dimmed" size="sm">
              {deck.person_count} {deck.person_count === 1 ? 'person' : 'people'}
              {deck.type === 'virtual' && deck.due_count > 0 && ` · ${deck.due_count} due`}
              {deck.type === 'prebuilt' && deck.accuracy !== null && ` · ${deck.accuracy}% accuracy`}
            </Text>
          </div>
          <Group gap="xs">
            <Button variant="light" onClick={() => setTipsOpen(true)}>Technique Tips</Button>
            {deck.type === 'virtual' && (
              <Button onClick={() => navigate('/study')}>Start Studying</Button>
            )}
          </Group>
        </Group>

        {deck.people.length === 0 ? (
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Text c="dimmed" ta="center">No one in this deck yet.</Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
            {deck.people.map(person => (
              <Stack key={person.id} align="center" gap={4}>
                <Avatar src={person.photo_path} size={90} radius="md">
                  {person.first_name[0]}{person.last_name?.[0] || ''}
                </Avatar>
                <Text size="sm" fw={500} ta="center">
                  {person.first_name} {person.last_name || ''}
                </Text>
                {'attribution_author' in person && person.attribution_author && (
                  <Text size="xs" c="dimmed" ta="center">
                    Photo: {person.attribution_author}
                  </Text>
                )}
              </Stack>
            ))}
          </SimpleGrid>
        )}

        <Button variant="subtle" onClick={() => navigate('/')}>Back to Decks</Button>
      </Stack>

      <Modal opened={tipsOpen} onClose={() => setTipsOpen(false)} title="Name-Recall Techniques" size="md">
        <List spacing="md">
          {TECHNIQUE_TIPS.map(tip => (
            <List.Item key={tip.title}>
              <Text fw={600}>{tip.title}</Text>
              <Text size="sm" c="dimmed">{tip.body}</Text>
            </List.Item>
          ))}
        </List>
        <Group justify="flex-end" mt="lg">
          <Badge variant="light">You can reopen this anytime</Badge>
        </Group>
      </Modal>
    </Container>
  );
}
