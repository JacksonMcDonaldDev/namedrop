import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Card, Image, Text, Stack, Group, Button, Skeleton, Title, List } from '@mantine/core';
import { getDeckDetail } from '../api/decks';
import type { PrebuiltDeckPerson } from '../api/decks';
import { startDrillSession, submitDrillEvent, completeDrillSession } from '../api/practiceSessions';
import type { DrillResult, DrillSummary } from '../api/practiceSessions';

type DrillState = 'loading' | 'error' | 'front' | 'back' | 'submitting' | 'complete';

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface ScoredPerson {
  person: PrebuiltDeckPerson;
  result: DrillResult;
}

export default function Drill() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<DrillState>('loading');
  const [deckName, setDeckName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<PrebuiltDeckPerson[]>([]);
  const [index, setIndex] = useState(0);
  const [scored, setScored] = useState<ScoredPerson[]>([]);
  const [summary, setSummary] = useState<DrillSummary | null>(null);

  useEffect(() => {
    if (!id) return;

    async function init(deckId: string) {
      try {
        const deck = await getDeckDetail(deckId);
        if (deck.type !== 'prebuilt') throw new Error('This deck does not support drill sessions');

        const session = await startDrillSession(deckId);
        setDeckName(deck.name);
        setSessionId(session.id);
        setQueue(shuffled(deck.people));
        setState(deck.people.length > 0 ? 'front' : 'complete');
      } catch (err) {
        console.error(err);
        setState('error');
      }
    }

    init(id);
  }, [id]);

  const current = queue[index];

  const handleReveal = () => setState('back');

  const handleMark = async (result: DrillResult) => {
    if (!id || !sessionId || !current) return;
    setState('submitting');
    try {
      await submitDrillEvent(id, sessionId, current.id, result);
      setScored(prev => [...prev, { person: current, result }]);

      if (index + 1 >= queue.length) {
        const sum = await completeDrillSession(id, sessionId);
        setSummary(sum);
        setState('complete');
      } else {
        setIndex(index + 1);
        setState('front');
      }
    } catch (err) {
      console.error(err);
      setState('back');
    }
  };

  if (state === 'loading') {
    return (
      <Container size="sm" py="xl">
        <Stack align="center" gap="lg">
          <Skeleton height={300} width={300} radius="md" />
          <Skeleton height={40} width={200} />
        </Stack>
      </Container>
    );
  }

  if (state === 'error') {
    return (
      <Container size="sm" py="xl">
        <Stack align="center" gap="lg">
          <Title order={2}>Couldn't start the drill</Title>
          <Button onClick={() => navigate('/')}>Back to Decks</Button>
        </Stack>
      </Container>
    );
  }

  if (state === 'complete') {
    return <DrillSummaryView deckName={deckName} scored={scored} summary={summary} onBack={() => navigate('/')} />;
  }

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg">
        <Group justify="space-between" w="100%">
          <Text size="sm" c="dimmed">{index + 1} of {queue.length}</Text>
          <Button variant="subtle" size="xs" onClick={() => navigate(`/decks/${id}`)}>Quit</Button>
        </Group>

        <Card shadow="md" padding={0} radius="lg" withBorder w="100%" maw={400}>
          {current?.photo_path && (
            <Card.Section>
              <Image
                src={current.photo_path}
                height={350}
                alt="Face"
                fit="cover"
                onClick={state === 'front' ? handleReveal : undefined}
                style={{ cursor: state === 'front' ? 'pointer' : 'default' }}
              />
            </Card.Section>
          )}

          {state === 'front' ? (
            <Stack align="center" p="lg" gap="sm">
              <Text c="dimmed" size="sm">Who is this?</Text>
              <Button variant="light" onClick={handleReveal}>Reveal</Button>
            </Stack>
          ) : (
            <Stack p="lg" gap="xs">
              <Text fw={700} size="xl">
                {current?.first_name} {current?.last_name || ''}
              </Text>
              {current?.mnemonic && (
                <Text size="sm" fs="italic"><Text component="span" c="dimmed">Mnemonic:</Text> {current.mnemonic}</Text>
              )}
            </Stack>
          )}
        </Card>

        {state === 'back' && (
          <Group grow w="100%" maw={400}>
            <Button variant="light" color="red" onClick={() => handleMark('missed_it')}>Missed it</Button>
            <Button variant="light" color="green" onClick={() => handleMark('got_it')}>Got it</Button>
          </Group>
        )}

        {state === 'submitting' && <Skeleton height={40} width={300} />}
      </Stack>
    </Container>
  );
}

function DrillSummaryView({
  deckName, scored, summary, onBack,
}: {
  deckName: string;
  scored: ScoredPerson[];
  summary: DrillSummary | null;
  onBack: () => void;
}) {
  const hits = scored.filter(s => s.result === 'got_it');
  const misses = scored.filter(s => s.result === 'missed_it');
  const personLabel = (p: PrebuiltDeckPerson) => `${p.first_name} ${p.last_name || ''}`.trim();

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg">
        <Title order={2}>Session Complete</Title>
        <Text c="dimmed">{deckName}</Text>

        <Card shadow="sm" padding="lg" radius="md" withBorder w="100%" maw={400}>
          <Stack gap="md">
            <Group justify="center" gap="xl">
              <Stack gap={0} align="center">
                <Text size="xl" fw={700} c="green">{summary?.got_it ?? hits.length}</Text>
                <Text size="sm" c="dimmed">Got it</Text>
              </Stack>
              <Stack gap={0} align="center">
                <Text size="xl" fw={700} c="red">{summary?.missed_it ?? misses.length}</Text>
                <Text size="sm" c="dimmed">Missed it</Text>
              </Stack>
              {summary?.accuracy !== null && summary?.accuracy !== undefined && (
                <Stack gap={0} align="center">
                  <Text size="xl" fw={700}>{Math.round(summary.accuracy * 100)}%</Text>
                  <Text size="sm" c="dimmed">Accuracy</Text>
                </Stack>
              )}
            </Group>

            {misses.length > 0 && (
              <Stack gap={4}>
                <Text size="sm" fw={600}>Missed</Text>
                <List size="sm">
                  {misses.map(m => <List.Item key={m.person.id}>{personLabel(m.person)}</List.Item>)}
                </List>
              </Stack>
            )}

            {hits.length > 0 && (
              <Stack gap={4}>
                <Text size="sm" fw={600}>Got it</Text>
                <List size="sm">
                  {hits.map(h => <List.Item key={h.person.id}>{personLabel(h.person)}</List.Item>)}
                </List>
              </Stack>
            )}
          </Stack>
        </Card>

        <Button size="lg" onClick={onBack}>Back to Decks</Button>
      </Stack>
    </Container>
  );
}
