import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Container,
  Title,
  TextInput,
  Button,
  Stack,
  Group,
  Image,
  Text,
  Card,
  Modal,
  Notification,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import {
  getContact,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
  scrapeLinkedIn,
} from "../api/contacts";
import type { Contact } from "../api/contacts";

interface FormValues {
  first_name: string;
  last_name: string;
  where_met: string;
  mnemonic: string;
}

export default function ContactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id) && id !== "new";

  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [placeholderMatch, setPlaceholderMatch] = useState<Contact | null>(
    null,
  );
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinLoading, setLinkedinLoading] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      first_name: "",
      last_name: "",
      where_met: "",
      mnemonic: "",
    },
    validate: {
      first_name: (value) =>
        value.trim().length === 0 ? "First name is required" : null,
    },
  });

  useEffect(() => {
    if (isEdit && id) {
      getContact(id)
        .then((contact) => {
          form.setValues({
            first_name: contact.first_name,
            last_name: contact.last_name || "",
            where_met: contact.where_met || "",
            mnemonic: contact.mnemonic || "",
          });
          if (contact.photo_path) {
            setExistingPhoto(contact.photo_path);
          }
        })
        .catch((err) => {
          console.error(err);
          navigate("/contacts");
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
        const match = results.find(
          (c: any) =>
            c.is_placeholder &&
            c.first_name.toLowerCase() === firstName.toLowerCase(),
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

  const handleNativeDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If files are present (local file drop), let Dropzone handle it
    if (e.dataTransfer.files.length > 0) return;

    // Handle image URL dragged from another browser window
    const url =
      e.dataTransfer.getData("text/uri-list") ||
      e.dataTransfer.getData("text/plain");

    // Extract URL from HTML img tag if needed
    const html = e.dataTransfer.getData("text/html");
    const imgSrc =
      url || html?.match(/<img[^>]+src=["']([^"']+)["']/)?.[1];

    if (!imgSrc) return;

    try {
      const res = await fetch(imgSrc);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) return;
      const ext = blob.type.split("/")[1] || "jpg";
      const file = new File([blob], `dropped-image.${ext}`, {
        type: blob.type,
      });
      handlePhotoDrop([file]);
    } catch {
      notifications.show({
        title: "Image drop failed",
        message:
          "Could not load the image. The source may block cross-origin requests.",
        color: "red",
      });
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
      });

      if (data.photo_base64) {
        const res = await fetch(data.photo_base64);
        const blob = await res.blob();
        const file = new File([blob], "linkedin-photo.jpg", {
          type: blob.type,
        });
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setRemovePhoto(false);
      }

      notifications.show({
        title: "LinkedIn Import",
        message: "Profile data imported successfully",
        color: "green",
      });
    } catch (err: any) {
      notifications.show({
        title: "LinkedIn Import Failed",
        message: err.message || "Could not fetch LinkedIn profile",
        color: "red",
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
        if (data[key] === "") data[key] = undefined;
      }
      formData.append("data", JSON.stringify(data));

      if (photoFile) {
        formData.append("photo", photoFile);
      }
      if (removePhoto) {
        formData.append("remove_photo", "true");
      }

      if (isEdit && id) {
        await updateContact(id, formData);
      } else {
        await createContact(formData);
      }

      notifications.show({
        title: "Success",
        message: isEdit ? "Contact updated" : "Contact created",
        color: "green",
      });
      navigate("/contacts");
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Something went wrong",
        color: "red",
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
        title: "Deleted",
        message: "Contact deleted",
        color: "blue",
      });
      navigate("/contacts");
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to delete",
        color: "red",
      });
    }
    setDeleteModalOpen(false);
  };

  const currentPhoto = photoPreview || existingPhoto;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>{isEdit ? "Edit Contact" : "Add Contact"}</Title>
          {isEdit && (
            <Button
              color="red"
              variant="subtle"
              onClick={() => setDeleteModalOpen(true)}
            >
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
            A placeholder named "{placeholderMatch.first_name}" already exists.{" "}
            <Text
              component="span"
              c="blue"
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => navigate(`/contacts/${placeholderMatch.id}`)}
            >
              Edit it instead
            </Text>{" "}
            to promote it to a full contact and preserve existing references.
          </Notification>
        )}

        {!isEdit && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group>
              <TextInput
                placeholder="LinkedIn profile URL"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button onClick={handleLinkedInFetch} loading={linkedinLoading}>
                Import
              </Button>
            </Group>
          </Card>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {/* Photo upload */}
            <Card
              shadow="sm"
              padding="md"
              radius="md"
              withBorder
              onDrop={handleNativeDrop}
              onDragOver={(e: React.DragEvent) => e.preventDefault()}
            >
              <Text fw={500} mb="xs">
                Photo
              </Text>
              {currentPhoto ? (
                <Stack gap="xs" align="center">
                  <Image
                    src={currentPhoto}
                    fit="cover"
                    radius="md"
                    style={{ width: 220, height: 275 }}
                  />
                  <Group>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={handleRemovePhoto}
                    >
                      Remove photo
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Dropzone
                  onDrop={handlePhotoDrop}
                  accept={IMAGE_MIME_TYPE}
                  maxSize={10 * 1024 * 1024}
                  multiple={false}
                  style={{ width: 220, aspectRatio: "4 / 5" }}
                >
                  <Stack align="center" justify="center" gap="xs" h="100%">
                    <Text size="lg" c="dimmed" ta="center">
                      Drop a photo here or click to upload
                    </Text>
                    <Text size="xs" c="dimmed">
                      JPEG, PNG, or WebP — max 10MB
                    </Text>
                  </Stack>
                </Dropzone>
              )}
            </Card>

            <Group grow>
              <TextInput
                label="First Name"
                required
                {...form.getInputProps("first_name")}
              />
              <TextInput
                label="Last Name"
                {...form.getInputProps("last_name")}
              />
            </Group>
            <TextInput
              label="Mnemonic Device"
              placeholder="A memory hook for their name"
              {...form.getInputProps("mnemonic")}
            />
            <TextInput
              label="Where Met"
              placeholder="e.g. AWS re:Invent 2025, Las Vegas"
              {...form.getInputProps("where_met")}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate("/contacts")}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {isEdit ? "Save Changes" : "Create Contact"}
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
          <Text>
            Are you sure you want to delete this contact? This cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
