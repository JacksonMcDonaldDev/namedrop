import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Image, Text, Stack, Group, Button, SegmentedControl, Skeleton, Title } from '@mantine/core';
import { startSession, submitReview, completeSession } from '../api/study';
import type { StudyCard, SessionSummary } from '../api/study';

type StudyState = 'loading' | 'empty' | 'front' | 'back' | 'submitting' | 'complete';

export default function Study() {
  const navigate = useNavigate();
  const [state, setState] = useState<StudyState>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [card, setCard] = useState<StudyCard | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    startSession().then(res => {
      if (res.empty) {
        setState('empty');
        setNextDue(res.next_due || null);
      } else if (res.session_id && res.card) {
        setSessionId(res.session_id);
        setCard(res.card);
        setRemaining(res.remaining ?? 0);
        setState('front');
      }
    }).catch(err => {
      console.error(err);
      setState('empty');
    });
  }, []);

  const handleReveal = () => setState('back');

  const handleRate = async (rating: string) => {
    if (!sessionId || !card) return;
    setState('submitting');
    try {
      const res = await submitReview(sessionId, card.id, rating);
      if (res.complete) {
        const sum = await completeSession(sessionId);
        setSummary(sum);
        setState('complete');
      } else if (res.card) {
        setCard(res.card);
        setRemaining(res.remaining ?? 0);
        setState('front');
      }
    } catch (err) {
      console.error(err);
      setState('front');
    }
  };

  const handleQuit = async () => {
    if (sessionId) {
      try {
        await completeSession(sessionId);
      } catch {
        // ignore
      }
    }
    navigate('/');
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

  if (state === 'empty') {
    return (
      <Container size="sm" py="xl">
        <Stack align="center" gap="lg">
          <Title order={2}>Nothing to study</Title>
          <Text c="dimmed">
            {nextDue
              ? `Next card due ${new Date(nextDue).toLocaleDateString()}`
              : 'Add contacts with photos to start studying'}
          </Text>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </Stack>
      </Container>
    );
  }

  if (state === 'complete') {
    return <SessionSummaryView summary={summary!} onBack={() => navigate('/')} />;
  }

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg">
        {/* Quit button */}
        <Group justify="space-between" w="100%">
          <Text size="sm" c="dimmed">{remaining + 1} card{remaining > 0 ? 's' : ''} remaining</Text>
          <Button variant="subtle" size="xs" onClick={handleQuit}>Quit</Button>
        </Group>

        {/* Card */}
        <Card shadow="md" padding={0} radius="lg" withBorder w="100%" maw={400}>
          {card?.photo_path && (
            <Card.Section>
              <Image
                src={card.photo_path}
                height={350}
                alt="Contact photo"
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
                {card?.first_name} {card?.last_name || ''}
              </Text>
              {card?.where_met && <Text size="sm"><Text component="span" c="dimmed">Where met:</Text> {card.where_met}</Text>}
              {card?.mnemonic && <Text size="sm" fs="italic"><Text component="span" c="dimmed">Mnemonic:</Text> {card.mnemonic}</Text>}
            </Stack>
          )}
        </Card>

        {/* Rating controls */}
        {state === 'back' && (
          <Stack align="center" gap="xs" w="100%" maw={400}>
            <Text size="sm" c="dimmed">How well did you recall?</Text>
            <SegmentedControl
              fullWidth
              size="md"
              data={[
                { value: 'again', label: 'Again' },
                { value: 'hard', label: 'Hard' },
                { value: 'good', label: 'Good' },
                { value: 'easy', label: 'Easy' },
              ]}
              onChange={handleRate}
            />
          </Stack>
        )}

        {state === 'submitting' && (
          <Skeleton height={40} width={300} />
        )}
      </Stack>
    </Container>
  );
}

function SessionSummaryView({ summary, onBack }: { summary: SessionSummary; onBack: () => void }) {
  const total = summary.total_reviewed;
  const segments = [
    { value: total ? (summary.again / total) * 100 : 0, color: 'red', label: 'Again' },
    { value: total ? (summary.hard / total) * 100 : 0, color: 'orange', label: 'Hard' },
    { value: total ? (summary.good / total) * 100 : 0, color: 'blue', label: 'Good' },
    { value: total ? (summary.easy / total) * 100 : 0, color: 'green', label: 'Easy' },
  ].filter(s => s.value > 0);

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg">
        <Title order={2}>Session Complete</Title>
        <Card shadow="sm" padding="lg" radius="md" withBorder w="100%" maw={400}>
          <Stack gap="md">
            <Text fw={500} size="lg" ta="center">{total} card{total !== 1 ? 's' : ''} reviewed</Text>

            <Stack gap="xs">
              {summary.again > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="red">Again</Text>
                  <Text size="sm" fw={500}>{summary.again}</Text>
                </Group>
              )}
              {summary.hard > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="orange">Hard</Text>
                  <Text size="sm" fw={500}>{summary.hard}</Text>
                </Group>
              )}
              {summary.good > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="blue">Good</Text>
                  <Text size="sm" fw={500}>{summary.good}</Text>
                </Group>
              )}
              {summary.easy > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="green">Easy</Text>
                  <Text size="sm" fw={500}>{summary.easy}</Text>
                </Group>
              )}
            </Stack>

            {/* Simple bar chart */}
            {total > 0 && (
              <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
                {segments.map(s => (
                  <div
                    key={s.label}
                    style={{
                      width: `${s.value}%`,
                      backgroundColor: s.color === 'red' ? '#fa5252' :
                        s.color === 'orange' ? '#fd7e14' :
                        s.color === 'blue' ? '#228be6' : '#40c057',
                    }}
                  />
                ))}
              </div>
            )}
          </Stack>
        </Card>

        <Button size="lg" onClick={onBack}>Back to Dashboard</Button>
      </Stack>
    </Container>
  );
}
