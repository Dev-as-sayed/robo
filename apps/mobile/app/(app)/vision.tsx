import { useState } from "react";
import { Alert, Image, Linking, StyleSheet, Text, View } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { apiErrorMessage } from "@/api/errors";
import { useExplainImageMutation } from "@/api/vision-api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ReportAnswerButton } from "@/components/ReportAnswerButton";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import { colors, radii, spacing } from "@/theme";

interface PickedImage {
  uri: string;
  base64: string;
}

export default function VisionScreen() {
  const router = useRouter();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [explainImage, { isLoading }] = useExplainImageMutation();

  const showPermissionHelp = (message: string) => {
    Alert.alert("Permission needed", message, [
      { text: "Not now", style: "cancel" },
      {
        text: "Open settings",
        onPress: () => void Linking.openSettings(),
      },
    ]);
  };

  const processAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    const converted = await ImageManipulator.manipulateAsync(asset.uri, [], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    if (!converted.base64) {
      setFormError("That photo could not be read. Try another one.");
      return;
    }

    setImage({ uri: converted.uri, base64: converted.base64 });
  };

  const takePhoto = async () => {
    setFormError(null);
    setAnswer(null);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        const message =
          "Camera access is off. Enable it in Settings to photograph formulas.";
        setFormError(message);
        showPermissionHelp(message);
        return;
      }

      const picked = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        cameraType: ImagePicker.CameraType.back,
        quality: 1,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];

      if (asset) {
        await processAsset(asset);
      }
    } catch {
      setFormError("The camera could not open on this device.");
    }
  };

  const chooseImage = async () => {
    setFormError(null);
    setAnswer(null);

    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];

      if (asset) {
        await processAsset(asset);
      }
    } catch {
      setFormError("The photo picker could not open on this device.");
    }
  };

  const explain = async () => {
    setFormError(null);
    if (!image) {
      setFormError("Choose a photo first.");
      return;
    }

    try {
      const result = await explainImage({
        imageBase64: image.base64,
        mimeType: "image/jpeg",
        ...(question.trim() ? { question: question.trim() } : {}),
      }).unwrap();
      setAnswer(result);
    } catch (cause) {
      setFormError(
        apiErrorMessage(cause, "Robo could not explain that image.")
      );
    }
  };

  return (
    <Screen>
      <ScreenHeader
        kicker="STUDY HELPER"
        onBack={() => router.back()}
      />

      <Card title="EXPLAIN A PHOTO">
        <Text style={styles.muted}>
          Take a photo of a formula, diagram or handwritten problem, or choose
          one from your library. Robo reads the image and walks you through it.
          Only academic content is used.
        </Text>

        {image ? (
          <Image
            source={{ uri: image.uri }}
            style={styles.preview}
            resizeMode="contain"
            accessibilityLabel="Selected study photo"
          />
        ) : null}

        <Button
          label={image ? "Take another photo" : "Take a photo"}
          onPress={() => void takePhoto()}
        />
        <Button
          label="Choose from library"
          variant="ghost"
          onPress={() => void chooseImage()}
        />
        <TextField
          label="What should Robo explain?"
          value={question}
          onChangeText={setQuestion}
          placeholder="Explain step by step"
        />
        <Button
          label="Explain this photo"
          onPress={() => void explain()}
          loading={isLoading}
          disabled={!image}
        />
      </Card>

      {formError ? <ErrorBanner message={formError} /> : null}

      {answer ? (
        <Card title="ROBO'S EXPLANATION" tone="accent">
          <Text style={styles.answer}>{answer}</Text>
          <ReportAnswerButton surface="VISION" responseText={answer} />
        </Card>
      ) : (
        <View style={styles.tip}>
          <Text style={styles.tipTitle}>Tips for a clear answer</Text>
          <Text style={styles.muted}>
            Keep the whole formula in frame, avoid glare, and write the
            question underneath if it is not in the photo.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  preview: {
    width: "100%",
    height: 240,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  answer: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  tip: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  tipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
