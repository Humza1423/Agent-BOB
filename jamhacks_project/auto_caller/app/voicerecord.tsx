import { View, StyleSheet, TouchableOpacity, StatusBar, Animated, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { useNavigation } from 'expo-router';
import { TextInput, Button, Text, Surface } from "react-native-paper";
import  { AccountProvider, useAccountContext } from './components/AccountContext';

const VoiceRecord = () => {
  // State declarations
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [visualFeedback, setVisualFeedback] = useState('Tap to start');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [URI, setURI] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAccountContext();
  
  // Animation refs
  const animatedSize = useRef(new Animated.Value(1)).current;
  const animatedOpacity = useRef(new Animated.Value(1)).current;

  const { handleSubmit } = useForm();
  const navigation = useNavigation<any>();
  
  // Pulse animation when recording
  useEffect(() => {
    let pulseAnimation: any;
    
    if (isRecording) {
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedSize, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animatedSize, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      
      pulseAnimation.start();
    } else {
      Animated.spring(animatedSize, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
      }).start();
    }
    
    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [isRecording]);
  
  // Request mic permissions on component mount
  useEffect(() => {
    const getPermissions = async () => {
      await requestPermission();
    };
    getPermissions();
  }, []);

  async function startRecording() {
    try {
      // Check if permission is granted
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      console.log('Starting recording...');
      setVisualFeedback('Listening...');
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      
      // Start opacity pulsing for the ring
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedOpacity, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedOpacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
    } catch (err) {
      console.error('Failed to start recording', err);
      setVisualFeedback('Error starting recording');
    }
  }

  async function stopRecording() {
    console.log('Stopping recording...');
    setVisualFeedback('Processing...');
    
    if (!recording) return;
    
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    
    if (uri) {
      setURI(uri);
      console.log('Recording stopped. URI:', uri);
    }
    
    // Reset animations
    animatedOpacity.setValue(1);
    setVisualFeedback('Tap to start');
  }

  async function sendAudioToServer(uri: string, email: string, username: string, password: string, phoneNumber: string) {
    if (!uri) {
      console.log('No recording found');
      setVisualFeedback('No recording found');
      return;
    }
    
    // Simple validation
    if (!email || !username || !password || !phoneNumber) {
      setVisualFeedback('Please fill all fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create FormData for sending the file
      const formData = new FormData();
      formData.append('audio', {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('phone_number', phoneNumber);

      setVisualFeedback('Sending to server...');
      console.log('Sending audio to server...');
      const response = await fetch('http://10.37.123.232:5001/signup', {
        method: 'POST',
        body: formData,
        // headers: {
        //   'Content-Type': 'multipart/form-data',
        // },
      });

      const result = await response.json();
      if (result.message) {
        await login(email, password);
      }
      console.log('Server response:', result);
      setVisualFeedback('Account created successfully!');
      
      // Reset visual feedback after a delay
      setTimeout(() => {
        setVisualFeedback('Tap to start');
      }, 2000);
    } catch (error) {
      console.error('Error sending audio to server:', error);
      setVisualFeedback('Error sending audio');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={['#6a11cb', '#2575fc']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar translucent backgroundColor="transparent" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Voice Registration</Text>
          <Text style={styles.subtitle}>Create your voice-powered account</Text>
          
          <Surface style={styles.formContainer}>
            <TextInput
              mode="outlined"
              label="Username"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              outlineColor="#8a3cff"
              activeOutlineColor="#6a11cb"
            />

            <TextInput
              mode="outlined"
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              style={styles.input}
              outlineColor="#8a3cff"
              activeOutlineColor="#6a11cb"
            />

            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              outlineColor="#8a3cff"
              activeOutlineColor="#6a11cb"
            />

            <TextInput
              mode="outlined"
              label="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor="#8a3cff"
              activeOutlineColor="#6a11cb"
            />

            <Text style={styles.recordingInstructions}>
              Record your voice for voice authentication:
            </Text>

            <View style={styles.recordingContainer}>
              <Animated.View 
                style={[
                  styles.pulseRing,
                  { 
                    opacity: animatedOpacity,
                    transform: [{ scale: animatedSize }] 
                  }
                ]}
              />
              
              <TouchableOpacity
                style={styles.recordButton}
                onPress={isRecording ? stopRecording : startRecording}
                activeOpacity={0.8}
              >
                <FontAwesome5 
                  name={isRecording ? "stop" : "microphone"} 
                  size={isRecording ? 32 : 38} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.statusText}>{visualFeedback}</Text>
          </Surface>
          
          <Button 
            mode="contained" 
            onPress={() => sendAudioToServer(URI, email, username, password, phoneNumber)}
            style={styles.signupButton}
            labelStyle={styles.signupButtonText}
            loading={isLoading}
            disabled={isLoading || !URI}
            buttonColor="#DD2476"
            contentStyle={{ height: 48 }}
          >
            Create Account
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
      
      <View style={styles.tipsContainer}>
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Tips</Text>
          <Text style={styles.tipText}>• Record your voice clearly for best results</Text>
          <Text style={styles.tipText}>• Say a few sentences for voice authentication</Text>
          <Text style={styles.tipText}>• You'll use your voice to log in later</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

export default VoiceRecord;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 160, // Additional padding for tips container
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 30,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  recordingInstructions: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 16,
    color: '#333',
    textAlign: 'center',
  },
  recordingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(106, 17, 203, 0.2)',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff4c4c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#6a11cb',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  signupButton: {
    backgroundColor: '#DD2476',
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tipsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  tipCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  tipText: {
    fontSize: 15,
    marginBottom: 4,
    color: '#555',
    lineHeight: 22,
  },
});