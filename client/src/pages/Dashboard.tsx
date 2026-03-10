import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Text, Button, Stack, Card, Group, Skeleton } from '@mantine/core';
import { getStudyStatus } from '../api/study';
import type { StudyStatus } from '../api/study';

export default function Dashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StudyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudyStatus()
      .then(setStatus)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatNextDue = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'less than an hour';
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1}>namedrop</Title>
        <Text c="dimmed">Learn the names and faces of people you've met.</Text>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          {loading ? (
            <Stack gap="sm">
              <Skeleton height={24} width="60%" />
              <Skeleton height={40} />
            </Stack>
          ) : (
            <Stack gap="sm">
              {status && status.due_count > 0 ? (
                <>
                  <Text fw={500} size="lg">
                    {status.due_count} card{status.due_count !== 1 ? 's' : ''} due for review
                  </Text>
                  <Button size="lg" onClick={() => navigate('/study')}>
                    Study Now
                  </Button>
                </>
              ) : (
                <>
                  <Text fw={500} size="lg">No cards due right now</Text>
                  {status?.next_due && (
                    <Text c="dimmed">Next review in {formatNextDue(status.next_due)}</Text>
                  )}
                  <Button size="lg" variant="light" onClick={() => navigate('/study')}>
                    Study Now
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Card>

        <Group>
          <Button variant="default" size="lg" onClick={() => navigate('/contacts')} fullWidth>
            Contacts
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
