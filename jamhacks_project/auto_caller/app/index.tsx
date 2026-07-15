import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native'
import React from 'react'
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

const HexagonBackground = () => {
  return (
    <View style={styles.hexagonContainer}>
      {Array(10).fill(0).map((_, i) => (
        <View 
          key={i} 
          style={[
            styles.hexagon,
            {
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: [{ rotate: `${Math.random() * 360}deg` }],
            }
          ]} 
        />
      ))}
    </View>
  );
};

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <View style={styles.feature}>
      <LinearGradient
        colors={['#2E3192', '#1BFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featureIconContainer}
      >
        <MaterialCommunityIcons name={icon} size={32} color="#fff" />
      </LinearGradient>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
};

const index = () => {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#000428', '#004e92']}
        style={StyleSheet.absoluteFill}
      />
      <HexagonBackground />
      <BlurView intensity={20} tint="dark" style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Voice Assistant</Text>
          <Text style={styles.subtitle}>Your personal AI-powered voice companion</Text>
        </View>
        
        <View style={styles.featureContainer}>
          {[
            { icon: 'microphone', title: 'Voice Control', description: 'Natural voice commands' },
            { icon: 'flash', title: 'Fast Response', description: 'Instant AI processing' },
            { icon: 'shield-lock', title: 'Secure', description: 'End-to-end encryption' }
          ].map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </View>
        
        <Link href="/voicerecord" asChild>
          <TouchableOpacity>
            <LinearGradient
              colors={['#FF512F', '#DD2476']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.button, {
                shadowColor: '#DD2476',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }]}
            >
              <MaterialCommunityIcons name="arrow-right" size={24} color="#fff" style={styles.buttonIcon} />
              <Text style={[styles.buttonText, { textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }]}>
                Get Started
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Link>
      </BlurView>
    </View>
  );
};

export default index;

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hexagonContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.5,
  },
  hexagon: {
    position: 'absolute',
    width: 120,
    height: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  featureContainer: {
    width: '100%',
    maxWidth: 900,
    flexDirection: width > 500 ? 'row' : 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 40,
  },
  feature: {
    flex: width > 500 ? 1 : undefined,
    width: width > 500 ? undefined : '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  featureDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});