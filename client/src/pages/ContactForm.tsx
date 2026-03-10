import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, TextInput, Textarea, Select, Button, Stack, Group,
  Image, Text, Card, Modal, TagsInput, Notification,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { getContact, createContact, updateContact, deleteContact, updateMutuals, searchContacts, scrapeLinkedIn } from '../api/contacts';
import type { Contact, MutualContact } from '../api/contacts';

interface FormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  relationship: string;
  where_met: string;
  mnemonic: string;
  notes: string;
}

export default function ContactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id) && id !== 'new';

  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [mutualTags, setMutualTags] = useState<string[]>([]);
  const [originalMutuals, setOriginalMutuals] = useState<MutualContact[]>([]);
  const [placeholderMatch, setPlaceholderMatch] = useState<Contact | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinLoading, setLinkedinLoading] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: '',
      relationship: '',
      where_met: '',
      mnemonic: '',
      notes: '',
    },
    validate: {
      first_name: (value) => (value.trim().length === 0 ? 'First name is required' : null),
      email: (value) => {
        if (!value) return null;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Invalid email';
      },
    },
  });

  useEffect(() => {
    if (isEdit && id) {
      getContact(id).then(contact => {
        form.setValues({
          first_name: contact.first_name,
          last_name: contact.last_name || '',
          email: contact.email || '',
          phone: contact.phone || '',
          company: contact.company || '',
          relationship: contact.relationship || '',
          where_met: contact.where_met || '',
          mnemonic: contact.mnemonic || '',
          notes: contact.notes || '',
        });
        if (contact.photo_path) {
          setExistingPhoto(contact.photo_path);
        }
        if (contact.mutuals) {
          setOriginalMutuals(contact.mutuals);
          setMutualTags(contact.mutuals.map(m =>
            `${m.first_name}${m.last_name ? ' ' + m.last_name : ''}`
          ));
        }
      }).catch(err => {
        console.error(err);
        navigate('/contacts');
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // Check for placeholder match when creating new contact
  useEffect(() => {
    if (isEdit) return;
    const firstName = form.values.first_name.trim();
    if (!firstName) {
      setPlaceholderMatch(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const results = await searchContacts(firstName);
        const match = results.find((c: any) =>
          c.is_placeholder &&
          c.first_name.toLowerCase() === firstName.toLowerCase()
        );
        setPlaceholderMatch(match || null);
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.first_name, isEdit]);

  const handlePhotoDrop = (files: File[]) => {
    const file = files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setRemovePhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhoto(null);
    setRemovePhoto(true);
  };

  const handleLinkedInFetch = async () => {
    if (!linkedinUrl.trim()) return;
    setLinkedinLoading(true);
    try {
      const data = await scrapeLinkedIn(linkedinUrl.trim());
      form.setValues({
        first_name: data.first_name || form.values.first_name,
        last_name: data.last_name || form.values.last_name,
        company: data.company || form.values.company,
      });

      if (data.photo_base64) {
        const res = await fetch(data.photo_base64);
        const blob = await res.blob();
        const file = new File([blob], 'linkedin-photo.jpg', { type: blob.type });
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setRemovePhoto(false);
      }

      notifications.show({
        title: 'LinkedIn Import',
        message: 'Profile data imported successfully',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'LinkedIn Import Failed',
        message: err.message || 'Could not fetch LinkedIn profile',
        color: 'red',
      });
    } finally {
      setLinkedinLoading(false);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const formData = new FormData();
      const data: any = { ...values };
      // Clean empty strings to null
      for (const key of Object.keys(data)) {
        if (data[key] === '') data[key] = undefined;
      }
      formData.append('data', JSON.stringify(data));

      if (photoFile) {
        formData.append('photo', photoFile);
      }
      if (removePhoto) {
        formData.append('remove_photo', 'true');
      }

      let contact: Contact;
      if (isEdit && id) {
        contact = await updateContact(id, formData);
      } else {
        contact = await createContact(formData);
      }

      // Update mutuals
      const mutualsPayload = mutualTags.map(tag => {
        const existing = originalMutuals.find(m =>
          `${m.first_name}${m.last_name ? ' ' + m.last_name : ''}` === tag
        );
        return existing ? { id: existing.id } : { name: tag };
      });

      if (mutualsPayload.length > 0 || originalMutuals.length > 0) {
        await updateMutuals(contact.id, mutualsPayload);
      }

      notifications.show({
        title: 'Success',
        message: isEdit ? 'Contact updated' : 'Contact created',
        color: 'green',
      });
      navigate('/contacts');
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Something went wrong',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteContact(id);
      notifications.show({
        title: 'Deleted',
        message: 'Contact deleted',
        color: 'blue',
      });
      navigate('/contacts');
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to delete',
        color: 'red',
      });
    }
    setDeleteModalOpen(false);
  };

  const currentPhoto = photoPreview || existingPhoto;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>{isEdit ? 'Edit Contact' : 'Add Contact'}</Title>
          {isEdit && (
            <Button color="red" variant="subtle" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
          )}
        </Group>

        {placeholderMatch && !isEdit && (
          <Notification
            color="yellow"
            title="Existing placeholder found"
            onClose={() => setPlaceholderMatch(null)}
          >
            A placeholder named "{placeholderMatch.first_name}" already exists.{' '}
            <Text
              component="span"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate(`/contacts/${placeholderMatch.id}`)}
            >
              Edit it instead
            </Text>{' '}
            to promote it to a full contact and preserve existing references.
          </Notification>
        )}

        {!isEdit && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Text fw={500} mb="xs">Import from LinkedIn</Text>
            <Group align="flex-end">
              <TextInput
                label="LinkedIn Profile URL"
                placeholder="https://www.linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button onClick={handleLinkedInFetch} loading={linkedinLoading}>
                Fetch
              </Button>
            </Group>
          </Card>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {/* Photo upload */}
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Text fw={500} mb="xs">Photo</Text>
              {currentPhoto ? (
                <Stack gap="xs" align="center">
                  <Image src={currentPhoto} fit="cover" radius="md" style={{ width: 220, height: 275 }} />
                  <Group>
                    <Button size="xs" variant="subtle" onClick={handleRemovePhoto}>Remove photo</Button>
                  </Group>
                </Stack>
              ) : (
                <Dropzone
                  onDrop={handlePhotoDrop}
                  accept={IMAGE_MIME_TYPE}
                  maxSize={10 * 1024 * 1024}
                  multiple={false}
                  style={{ width: 220, aspectRatio: '4 / 5' }}
                >
                  <Stack align="center" justify="center" gap="xs" h="100%">
                    <Text size="lg" c="dimmed" ta="center">Drop a photo here or click to upload</Text>
                    <Text size="xs" c="dimmed">JPEG, PNG, or WebP — max 10MB</Text>
                  </Stack>
                </Dropzone>
              )}
            </Card>

            <TextInput
              label="First Name"
              required
              {...form.getInputProps('first_name')}
            />
            <TextInput
              label="Last Name"
              {...form.getInputProps('last_name')}
            />
            <TextInput
              label="Email"
              type="email"
              {...form.getInputProps('email')}
            />
            <TextInput
              label="Phone"
              {...form.getInputProps('phone')}
            />
            <TextInput
              label="Company"
              {...form.getInputProps('company')}
            />
            <Select
              label="Relationship"
              data={['Colleague', 'Client', 'Friend', 'Acquaintance', 'Other']}
              clearable
              searchable
              {...form.getInputProps('relationship')}
            />
            <TextInput
              label="Where Met"
              placeholder="e.g. AWS re:Invent 2025, Las Vegas"
              {...form.getInputProps('where_met')}
            />

            <TagsInput
              label="Mutual Connections"
              placeholder="Type a name and press Enter"
              value={mutualTags}
              onChange={setMutualTags}
            />

            <TextInput
              label="Mnemonic Device"
              placeholder="A memory hook for their name"
              {...form.getInputProps('mnemonic')}
            />
            <Textarea
              label="Notes"
              autosize
              minRows={3}
              {...form.getInputProps('notes')}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate('/contacts')}>Cancel</Button>
              <Button type="submit" loading={loading}>
                {isEdit ? 'Save Changes' : 'Create Contact'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Contact"
      >
        <Stack gap="md">
          <Text>Are you sure you want to delete this contact? This cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button color="red" onClick={handleDelete}>Delete</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
