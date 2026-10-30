import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Contacts from "expo-contacts";
import { useRouter } from "expo-router";
import { apiErrorMessage } from "@/api/errors";
import { useUpdateConsentMutation } from "@/api/account-api";
import {
  useContactsQuery,
  useCreateContactMutation,
  useDeleteContactMutation,
} from "@/api/contacts-api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import type { Contact } from "@/types";
import { ensurePermissionWithExplanation } from "@/permissions";
import { colors, radii, spacing } from "@/theme";

const fallbackGroup = "Other";

interface ContactGroup {
  label: string;
  items: Contact[];
}

function groupContacts(contacts: Contact[]): ContactGroup[] {
  const buckets = new Map<string, Contact[]>();

  for (const contact of contacts) {
    const label = contact.group?.trim() || fallbackGroup;
    const bucket = buckets.get(label);

    if (bucket) {
      bucket.push(contact);
    } else {
      buckets.set(label, [contact]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === fallbackGroup) return b === fallbackGroup ? 0 : 1;
      if (b === fallbackGroup) return -1;

      return a.localeCompare(b);
    })
    .map(([label, items]) => ({
      label,
      items: [...items].sort((x, y) => x.name.localeCompare(y.name)),
    }));
}

function preview(contact: Contact): string {
  const details = [contact.phone, contact.email].filter(Boolean);

  return details.length > 0 ? details.join(" · ") : "No phone or email";
}

function ContactRow({ contact }: { contact: Contact }) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [deleteContact] = useDeleteContactMutation();

  const open = async (message: string, url: string) => {
    setLinkError(null);

    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(message);
    }
  };

  const remove = () => {
    Alert.alert("Delete contact", contact.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteContact(contact.id),
      },
    ]);
  };

  const phone = contact.phone?.trim();
  const email = contact.email?.trim();

  const actions: { label: string; message: string; url: string }[] = [];

  if (phone) {
    actions.push(
      {
        label: "Call",
        message: "Robo could not start that call.",
        url: `tel:${phone}`,
      },
      {
        label: "Text",
        message: "Robo could not open Messages.",
        url: `sms:${phone}`,
      }
    );
  }

  if (email) {
    actions.push({
      label: "Email",
      message: "Robo could not open your mail app.",
      url: `mailto:${email}`,
    });
  }

  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{contact.name}</Text>
          <Text style={styles.rowMeta}>{preview(contact)}</Text>
        </View>

        {actions.map(action => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={`${action.label} ${contact.name}`}
            onPress={() => void open(action.message, action.url)}
            style={({ pressed }) => [
              styles.action,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${contact.name}`}
          onPress={remove}
          hitSlop={10}
          style={({ pressed }) => [
            styles.delete,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.deleteLabel}>✕</Text>
        </Pressable>
      </View>

      {linkError ? <ErrorBanner message={linkError} /> : null}
    </View>
  );
}

function phoneKey(value: string | null | undefined): string {
  return value?.replace(/[^\d]/g, "") ?? "";
}

export default function ContactsScreen() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useContactsQuery();
  const [createContact, { isLoading: creating }] = useCreateContactMutation();
  const [updateConsent] = useUpdateConsentMutation();

  const contacts = data ?? [];
  const groups = groupContacts(contacts);

  const pickFromPhone = async () => {
    setFormError(null);
    setImporting(true);

    try {
      if (Platform.OS === "web") {
        setFormError(
          "The phone contact picker is not available in the browser. Add the contact manually below."
        );
        return;
      }

      if (Platform.OS === "android") {
        const allowed = await ensurePermissionWithExplanation({
          title: "Choose a phone contact",
          message:
            "Robo opens your phone's contact picker so you can choose one person. It reads only the contact you select.",
          api: {
            get: async () => {
              const permission = await Contacts.getPermissionsAsync();
              return {
                status: permission.status,
                canAskAgain: permission.canAskAgain,
              };
            },
            request: async () => {
              const permission = await Contacts.requestPermissionsAsync();
              return {
                status: permission.status,
                canAskAgain: permission.canAskAgain,
              };
            },
          },
        });
        if (!allowed) {
          setFormError(
            "Robo needs contact permission to open the picker. You can still add contacts manually."
          );
          return;
        }
      }

      const picked = await Contacts.presentContactPickerAsync();
      if (!picked) return;

      const pickedName =
        picked.name?.trim() ||
        [picked.firstName, picked.lastName]
          .map(part => part?.trim())
          .filter((part): part is string => Boolean(part))
          .join(" ");
      const pickedPhone = picked.phoneNumbers?.[0]?.number?.trim() ?? "";
      const pickedEmail = picked.emails?.[0]?.email?.trim() ?? "";

      if (!pickedName) {
        setFormError(
          "That contact has no name. Pick another contact or add it manually below."
        );
        return;
      }

      const duplicate = contacts.find(contact => {
        const samePhone = Boolean(
          pickedPhone && phoneKey(contact.phone) === phoneKey(pickedPhone)
        );
        const sameEmail = Boolean(
          pickedEmail &&
            contact.email?.trim().toLowerCase() === pickedEmail.toLowerCase()
        );
        const sameName =
          contact.name.trim().toLowerCase() === pickedName.toLowerCase();

        return samePhone || sameEmail || sameName;
      });

      if (duplicate) {
        Alert.alert(
          "Already saved",
          `${duplicate.name} is already in your contacts.`
        );
        return;
      }

      await updateConsent({
        kind: "CONTACTS",
        granted: true,
        source: "contacts-picker",
      }).unwrap();

      setName(pickedName);
      setPhone(pickedPhone);
      setEmail(pickedEmail);
      setGroup("Imported");
      setFieldErrors({});
      Alert.alert(
        "Contact selected",
        "Review the details below and tap Add contact to save."
      );
    } catch (cause) {
      setFormError(
        apiErrorMessage(cause, "Robo could not open your phone contacts.")
      );
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setGroup("");
    setFieldErrors({});
    setFormError(null);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextErrors: { name?: string; email?: string } = {};

    if (!trimmedName) {
      nextErrors.name = "Give the contact a name.";
    }

    if (trimmedEmail && !trimmedEmail.includes("@")) {
      nextErrors.email = "An email needs an @ sign.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError(null);
      return;
    }

    const trimmedPhone = phone.trim();
    const trimmedGroup = group.trim();

    try {
      await createContact({
        name: trimmedName,
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(trimmedGroup ? { group: trimmedGroup } : {}),
      }).unwrap();
      reset();
    } catch (cause) {
      setFormError(
        apiErrorMessage(cause, "Robo could not save that contact. Try again.")
      );
    }
  };

  return (
    <Screen>
      <ScreenHeader kicker="CONTACTS" onBack={() => router.back()} />

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string"
              ? error
              : "Your contacts could not be loaded."
          }
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading contacts…</Text>
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet."
          body="Add the people Robo may need to reach, like a study partner or a tutor."
        />
      ) : (
        groups.map(section => (
          <Card key={section.label} title={section.label.toUpperCase()}>
            {section.items.map(contact => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </Card>
        ))
      )}

      <Card title="ADD FROM PHONE">
        <Text style={styles.muted}>
          Choose one person from your phone&apos;s contact picker. Robo reads
          only that contact, then fills in the form below so you can review it
          before saving.
        </Text>
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button
          label="Choose from phone"
          variant="ghost"
          onPress={() => void pickFromPhone()}
          loading={importing}
        />
      </Card>

      <Card title="NEW CONTACT">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Sam Rivera"
          autoCapitalize="words"
          error={fieldErrors.name}
        />
        <TextField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 555 0100"
          autoCapitalize="none"
          keyboardType="phone-pad"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="sam@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          error={fieldErrors.email}
        />
        <TextField
          label="Group"
          value={group}
          onChangeText={setGroup}
          placeholder="Study group"
          autoCapitalize="words"
        />
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button
          label="Add contact"
          onPress={() => void submit()}
          loading={creating}
        />
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => void refetch()}
        style={({ pressed }) => [
          styles.refresh,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.refreshLabel}>Refresh</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  rowWrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 140,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  action: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  actionLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  delete: {
    padding: spacing.xs,
  },
  deleteLabel: {
    color: colors.textMuted,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.82,
  },
  refresh: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  refreshLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
});
