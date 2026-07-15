import { AccountProvider, useAccountContext } from './components/AccountContext';
import { Stack } from "expo-router";
import { AppState } from "react-native";
import { Audio } from "expo-av";
import React, { useEffect, useRef } from "react";

// Global flag for command recording
let isCommandRecording = false;
// Global reference for any active recording
let activeAudioRecording: Audio.Recording | null = null;

const sendAudioToServer = async (uri: string, isCommand = false) => {
  try {
    const formData = new FormData();
    formData.append("audio", {
      uri,
      type: "audio/m4a",
      name: isCommand ? "command_recording.m4a" : "recording.m4a",
    } as any);
    const endpoint = isCommand
      ? "http://10.37.123.232:5001/upload-audio-2"
      : "http://10.37.123.232:5001/upload-audio-stt";
    console.log("Sending audio to server...", isCommand ? "command" : "normal");
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    const result = await response.json();
    console.log("Server response:", result);
    // For normal recordings, if the transcript contains "hey bob", start the command recording.
    if (!isCommand && result.transcript) {
      const transcriptLower = result.transcript.toLowerCase();
      if (transcriptLower.includes("hey bob")) {
        console.log('Detected "hey bob" in transcription.');
        if (!isCommandRecording) {
          recordCommandAndSend();
        }
      }
    }
  } catch (error) {
    console.error("Error sending audio:", error);
  }
};

const recordAndSend = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("Permission not granted for audio recording");
      return;
    }
    // If an active recording exists, attempt to unload it.
    if (activeAudioRecording) {
      try {
        await activeAudioRecording.stopAndUnloadAsync();
      } catch (e: any) {
        if (!e.message.includes("already been unloaded")) {
          console.error("Error unloading previous recording:", e);
        }
      }
      activeAudioRecording = null;
    }
    const recording = new Audio.Recording();
    activeAudioRecording = recording;
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    console.log("Recording started (wake clip)");
    setTimeout(async () => {
      try {
        if (activeAudioRecording === recording) {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          console.log("Recording stopped. URI:", uri);
          activeAudioRecording = null;
          if (uri) {
            await sendAudioToServer(uri);
          }
        }
      } catch (e: any) {
        // Ignore error if already unloaded.
        if (!e.message.includes("already been unloaded")) {
          console.error("Error stopping wake clip recording", e);
        }
      }
    }, 3000);
  } catch (error) {
    console.error("Error in recordAndSend:", error);
  }
};

const recordCommandUntilSilence = () => {
  return new Promise<string>(async (resolve, reject) => {
    try {
      isCommandRecording = true;
      console.log("Starting command recording (listening until silence)...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission not granted for command recording");
        isCommandRecording = false;
        return reject("Permission not granted");
      }
      if (activeAudioRecording) {
        try {
          await activeAudioRecording.stopAndUnloadAsync();
        } catch (e: any) {
          if (!e.message.includes("already been unloaded")) {
            console.error("Error unloading active recording:", e);
          }
        }
        activeAudioRecording = null;
      }
      const recording = new Audio.Recording();
      activeAudioRecording = recording;
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          meteringEnabled: true,
        },
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          isMetering: true,
        },
      });
      const silenceThreshold = -20; // Adjust as needed.
      const silenceDurationRequired = 3000; // 1 second of silence.
      let lastSoundTime = Date.now();
      let stopped = false;
      recording.setOnRecordingStatusUpdate(async (status) => {
        if (!status.isRecording || !status.metering) return;
        if (status.metering > silenceThreshold) {
          lastSoundTime = Date.now();
        } else {
          const silenceTime = Date.now() - lastSoundTime;
          if (silenceTime >= silenceDurationRequired && !stopped) {
            stopped = true;
            try {
              await recording.stopAndUnloadAsync();
              const uri = recording.getURI();
              console.log("Command recording stopped after silence. URI:", uri);
              activeAudioRecording = null;
              isCommandRecording = false;
              resolve(uri);
            } catch (e: any) {
              activeAudioRecording = null;
              isCommandRecording = false;
              if (!e.message.includes("already been unloaded")) {
                reject(e);
              } else {
                resolve(recording.getURI() || "");
              }
            }
          }
        }
      });
      await recording.startAsync();
    } catch (error) {
      isCommandRecording = false;
      reject(error);
    }
  });
};

const recordCommandAndSend = async () => {
  try {
    const uri = await recordCommandUntilSilence();
    if (uri) {
      await sendAudioToServer(uri, true);
    }
  } catch (error) {
    console.error("Error in recordCommandAndSend:", error);
  }
};

export default function RootLayout() {
  return (
    <AccountProvider>
      <Layout />
    </AccountProvider>
  );
}

export function Layout() {
  const recordingLoopRef = useRef<NodeJS.Timeout>();
  const appState = useRef(AppState.currentState);
  const { user } = useAccountContext();

  const startRecordingLoop = async () => {
    if (!isCommandRecording) {
      await recordAndSend();
    }
    recordingLoopRef.current = setTimeout(() => {
      startRecordingLoop();
    }, 3000);
  };

  useEffect(() => {
    if (user?.loggedIn) {
      startRecordingLoop();
      const subscription = AppState.addEventListener("change", (nextAppState) => {
        if (nextAppState === "active") {
          console.log("App has come to the foreground");
          startRecordingLoop();
        } else if (nextAppState.match(/inactive|background/)) {
          console.log("App has gone to the background");
          if (recordingLoopRef.current) clearTimeout(recordingLoopRef.current);
        }
        appState.current = nextAppState;
      });
      return () => {
        subscription.remove();
        if (recordingLoopRef.current) clearTimeout(recordingLoopRef.current);
      };
    }
  }, [user]);

  return (
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="voicerecord" options={{ title: "Voice Recorder" }} />
      </Stack>
  );
}