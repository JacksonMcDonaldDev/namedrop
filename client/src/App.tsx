import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MantineProvider, AppShell, Group, Anchor, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import Dashboard from './pages/Dashboard';
import ContactList from './pages/ContactList';
import ContactForm from './pages/ContactForm';
import Study from './pages/Study';

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
            <Anchor component={Link} to="/" underline="never" c="dark">
              <Text fw={700} size="lg">namedrop</Text>
            </Anchor>
            <Anchor component={Link} to="/contacts" underline="hover" c="dark" size="sm">
              Contacts
            </Anchor>
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
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </MantineProvider>
  );
}
