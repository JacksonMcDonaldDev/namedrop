import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MantineProvider, AppShell, Group, Anchor, Text, Button } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import DeckBrowser from './pages/DeckBrowser';
import DeckDetail from './pages/DeckDetail';
import ContactForm from './pages/ContactForm';
import Study from './pages/Study';
import Drill from './pages/Drill';
import ErrorBoundary from './ErrorBoundary';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';

function AppContent() {
  const location = useLocation();
  const isStudying = location.pathname.startsWith('/study') || /^\/decks\/[^/]+\/drill$/.test(location.pathname);

  return (
    <AppShell
      header={isStudying ? undefined : { height: 60 }}
      padding="md"
    >
      {!isStudying && (
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Anchor component={Link} to="/" underline="never" c="dimmed">
              <Text fw={700} size="lg">namedrop</Text>
            </Anchor>
            <Group gap="xs">
              <Button
                component={Link}
                to="/"
                variant={location.pathname === '/' ? 'light' : 'subtle'}
                size="sm"
              >
                Decks
              </Button>
            </Group>
          </Group>
        </AppShell.Header>
      )}
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<DeckBrowser />} />
          <Route path="/decks/my-people/new" element={<ContactForm />} />
          <Route path="/decks/my-people/:personId" element={<ContactForm />} />
          <Route path="/decks/:id" element={<DeckDetail />} />
          <Route path="/decks/:id/drill" element={<Drill />} />
          <Route path="/study" element={<Study />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MantineProvider theme={theme} forceColorScheme="dark">
        <Notifications position="top-right" />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </MantineProvider>
    </ErrorBoundary>
  );
}
