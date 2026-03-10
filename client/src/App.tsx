import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MantineProvider, AppShell, Group, Anchor, Text, Button } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import Dashboard from './pages/Dashboard';
import ContactList from './pages/ContactList';
import ContactForm from './pages/ContactForm';
import Study from './pages/Study';
import ErrorBoundary from './ErrorBoundary';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';

function AppContent() {
  const location = useLocation();
  const isStudying = location.pathname.startsWith('/study');

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
                Study
              </Button>
              <Button
                component={Link}
                to="/contacts"
                variant={location.pathname.startsWith('/contacts') ? 'light' : 'subtle'}
                size="sm"
              >
                Contacts
              </Button>
            </Group>
          </Group>
        </AppShell.Header>
      )}
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<ContactList />} />
          <Route path="/contacts/new" element={<ContactForm />} />
          <Route path="/contacts/:id" element={<ContactForm />} />
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
