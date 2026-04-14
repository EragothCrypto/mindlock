/**
 * Mindlock - Digital Warden for Brain-Rot Apps
 * 
 * A Solana Mobile dApp that locks "Brain-Rot" apps (TikTok, X, Reels)
 * and only releases them when you prove you've learned something
 * about the Solana ecosystem.
 * 
 * @format
 */

import 'react-native-get-random-values';
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

import React, { useState, useEffect, useCallback } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  NativeModules,
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { PublicKey } from '@solana/web3.js';
import { colors } from './src/theme/colors';
import { typography, fontFamilies, fontSizes } from './src/theme/typography';
import { spacing, shadows } from './src/theme';
import { useSeekerVerification } from './src/hooks/useSeekerVerification';
import { HardwareVerificationScreen } from './src/screens/HardwareVerificationScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AppPickerScreen } from './src/screens/AppPickerScreen';
import { SetupTutorialScreen, SetupProgress } from './src/screens/SetupTutorialScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { RewardClaimScreen } from './src/screens/RewardClaimScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { NETWORK_CONFIG } from './src/config/network';
import {
  hasSeenTutorial,
  setTutorialSeen,
  getBlockedApps,
  initializeStorage,
  hasPermissionsGranted,
  setPermissionsGranted,
  hasWardenActivated,
  setWardenActivated,
  getSavedSetupStep,
  saveSetupStep,
} from './src/utils/storage';

const { MindlockWarden } = NativeModules;

// App screens/states
type AppScreen =
  | 'loading'
  | 'onboarding'
  | 'setup'
  | 'app-picker'
  | 'dashboard'
  | 'leaderboard'
  | 'rewards'
  | 'day-pass';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.background}
        translucent={false}
      />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('loading');
  const [setupStep, setSetupStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [appPickerFromDashboard, setAppPickerFromDashboard] = useState(false);

  // Check for escape action from quiz screen (lazy unlock / day pass)
  useEffect(() => {
    const checkEscape = async () => {
      try {
        const nativeWarden = NativeModules.MindlockWarden;
        const action: string | null = await nativeWarden?.getEscapeAction?.();
        if (action === 'lazy_unlock') setCurrentScreen('rewards');
        else if (action === 'day_pass') setCurrentScreen('day-pass');
      } catch (_) { }
    };
    checkEscape();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkEscape();
    });
    return () => sub.remove();
  }, []);

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // App stats
  const [blockedAppsCount, setBlockedAppsCount] = useState(0);

  // Seeker Genesis NFT verification
  const { status: verificationStatus, isVerified, checkVerification } = useSeekerVerification(walletAddress);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize storage cache
      await initializeStorage();

      // Set up notification channels and schedule streak reminder
      setupNotifications().catch(() => {/* non-critical */ });

      const seenTutorial = hasSeenTutorial();
      const blockedApps = getBlockedApps();
      const permissionGranted = hasPermissionsGranted();
      const wardenActivated = hasWardenActivated();
      const savedStep = getSavedSetupStep();

      setBlockedAppsCount(blockedApps.length);

      if (!seenTutorial) {
        // First launch — show onboarding
        setCurrentScreen('onboarding');
      } else if (wardenActivated) {
        // Fully set up — go straight to dashboard
        setCurrentScreen('dashboard');
        setCompletedSteps([1, 2, 3, 4, 5]);
      } else {
        // Partially through setup — restore progress
        setCurrentScreen('setup');
        setSetupStep(savedStep);
        // Rebuild completedSteps from what we know
        const completed: number[] = [];
        if (savedStep > 1) completed.push(1);
        if (blockedApps.length > 0) completed.push(2);
        if (permissionGranted) completed.push(3);
        if (savedStep > 4) completed.push(4);
        setCompletedSteps(completed);
      }
    } catch (error) {
      console.error('Init error:', error);
      setCurrentScreen('onboarding');
    }
  };

  /** Create notification channels + schedule daily streak reminder at 8 PM */
  const setupNotifications = async () => {
    const { NotificationModule: NM } = NativeModules;
    if (!NM) return;
    // Request POST_NOTIFICATIONS permission on Android 13+
    if (Platform.OS === 'android' && (Platform.Version as number) >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ).catch(() => { });
    }
    await NM.createChannels?.().catch(() => { });
    // Schedule daily streak reminder at 20:00 (8 PM) — refresh each launch
    const status = await NativeModules.MindlockWarden?.getStatus?.().catch(() => null);
    const streak = status?.totalQuizzes ?? 0;
    await NM.scheduleStreakReminder?.(20, streak).catch(() => { });
  };

  // Handle onboarding complete
  const handleOnboardingComplete = () => {
    setTutorialSeen();
    setCurrentScreen('setup');
    setSetupStep(1);
  };

  // Handle setup step action
  const handleSetupAction = async (step: number) => {
    switch (step) {
      case 1: // Connect wallet
        await handleConnectWallet();
        break;

      case 2: // Select apps to block
        setCurrentScreen('app-picker');
        break;

      case 3: // Grant permissions — Usage Access + Screen Overlay
        // 1. Request Usage Stats permission
        MindlockWarden?.requestUsageStatsPermission?.();
        // 2. Also request Display Over Other Apps permission for quiz overlay
        setTimeout(() => {
          try {
            const { Linking } = require('react-native');
            Linking.openSettings(); // Opens app settings where user can enable overlay
            // Alternative: open the specific settings page
            Linking.sendIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION', [
              { key: 'package', value: 'com.mindlock' },
            ]).catch(() => { });
          } catch (_) { }
        }, 3000);
        // Check after longer delay — user needs to grant both
        setTimeout(() => {
          checkPermissionAndAdvance();
        }, 5000);
        break;

      case 4: // Charity & Karma info — just acknowledge and advance
        setCompletedSteps(prev => [...prev, 4]);
        setSetupStep(5);
        saveSetupStep(5);
        break;

      case 5: // ACTIVATE THE WARDEN ← was missing entirely
        try {
          await MindlockWarden?.initializeWarden?.(getBlockedApps());
          await MindlockWarden?.startWardenService?.();
          setWardenActivated(true);
          setCompletedSteps(prev => [...prev, 5]);
          setCurrentScreen('dashboard');
        } catch (err) {
          console.error('Warden activation failed:', err);
          // Still navigate to dashboard — warden may retry
          setWardenActivated(true);
          setCompletedSteps(prev => [...prev, 5]);
          setCurrentScreen('dashboard');
        }
        break;
    }
  };

  const checkPermissionAndAdvance = async () => {
    const granted = await MindlockWarden?.hasUsageStatsPermission?.();
    if (granted) {
      setPermissionsGranted(true);
      setCompletedSteps(prev => [...prev, 3]);
      setSetupStep(4);
      saveSetupStep(4);
    } else {
      // Permission not granted yet — stay on step 3
      console.log('Permission not yet granted, staying on step 3');
    }
  };

  // Handle app picker complete
  const handleAppPickerComplete = () => {
    const blockedApps = getBlockedApps();
    setBlockedAppsCount(blockedApps.length);

    if (appPickerFromDashboard) {
      // Came from Dashboard "Edit Apps" — go straight back to dashboard
      setAppPickerFromDashboard(false);
      setCurrentScreen('dashboard');
    } else {
      // Came from onboarding setup flow — advance to step 3
      setCompletedSteps(prev => [...prev, 2]);
      setSetupStep(3);
      saveSetupStep(3);
      setCurrentScreen('setup');
    }
  };

  // Handle skip setup
  const handleSkipSetup = () => {
    setCurrentScreen('dashboard');
  };

  // Wallet connect - Uses MWA for real Seed Vault connection
  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      // Dynamic import for MWA (only available on Seeker/Android)
      const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');

      await transact(async (wallet: any) => {
        // Authorize with Seed Vault (triggers biometric)
        const authResult = await wallet.authorize({
          cluster: NETWORK_CONFIG.network,
          identity: {
            name: 'Mindlock',
            uri: 'https://mindlock.app',
            icon: 'favicon.ico',
          },
        });

        // Get the authorized public key.
        // MWA returns address as Uint8Array (32 bytes), but when it crosses
        // the React Native JS bridge it can arrive as a plain object {0:b, 1:b, ...}
        // so instanceof Uint8Array fails. We handle all cases explicitly.
        if (authResult.accounts && authResult.accounts.length > 0) {
          const rawAddress = authResult.accounts[0].address;
          console.log('[MWA] address type:', typeof rawAddress,
            Array.isArray(rawAddress) ? 'array' : rawAddress instanceof Uint8Array ? 'Uint8Array' : 'other',
            JSON.stringify(rawAddress).slice(0, 80));

          let pubkey: PublicKey;
          if (typeof rawAddress === 'string') {
            // MWA on Seeker returns address as base64 (e.g. "pAHh3p...bgk=")
            // Base58 has no '/' or '=' chars — detect and decode accordingly
            const isBase64 = rawAddress.includes('/') || rawAddress.includes('+') || rawAddress.endsWith('=');
            pubkey = isBase64
              ? new PublicKey(Buffer.from(rawAddress, 'base64'))
              : new PublicKey(rawAddress); // already base58
          } else if (rawAddress instanceof Uint8Array) {
            // True Uint8Array
            pubkey = new PublicKey(rawAddress);
          } else if (Array.isArray(rawAddress)) {
            // Regular array of bytes
            pubkey = new PublicKey(new Uint8Array(rawAddress));
          } else if (rawAddress && typeof rawAddress === 'object') {
            // Plain object {0: byte, 1: byte, ...} from RN bridge serialisation
            pubkey = new PublicKey(new Uint8Array(Object.values(rawAddress as Record<string, number>)));
          } else {
            throw new Error(`Unrecognised MWA address format: ${typeof rawAddress}`);
          }

          setWalletAddress(pubkey);
          setCompletedSteps(prev => [...prev, 1]);
          setSetupStep(2);
          saveSetupStep(2);
        }
      });
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.warn('MWA connect failed:', msg);
      const { Alert } = require('react-native');
      Alert.alert(
        'Wallet Connection Failed',
        'Could not connect via the Seeker Mobile Wallet Adapter. Please make sure your Seed Vault is set up on this device and try again.\n\nError: ' + msg,
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // Wallet disconnect - Fixed implementation
  const handleDisconnect = useCallback(() => {
    setWalletAddress(null);
    setCompletedSteps([]);
    setBlockedAppsCount(0);
    // Stop the warden service when disconnecting
    MindlockWarden?.stopWardenService?.();
  }, []);

  // Show loading
  if (currentScreen === 'loading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>INITIALIZING...</Text>
      </View>
    );
  }

  // Show onboarding
  if (currentScreen === 'onboarding') {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Show setup tutorial
  if (currentScreen === 'setup') {
    return (
      <SetupTutorialScreen
        currentStep={setupStep}
        onStepAction={handleSetupAction}
        onSkip={handleSkipSetup}
        completedSteps={completedSteps}
      />
    );
  }

  // Show app picker
  if (currentScreen === 'app-picker') {
    return (
      <AppPickerScreen
        onComplete={handleAppPickerComplete}
        onBack={() => setCurrentScreen('setup')}
      />
    );
  }

  // Show leaderboard
  if (currentScreen === 'leaderboard') {
    return (
      <LeaderboardScreen
        onBack={() => setCurrentScreen('dashboard')}
        walletAddress={walletAddress?.toBase58()}
      />
    );
  }

  // Show rewards claim (also handles lazy unlock from quiz escape)
  if (currentScreen === 'rewards') {
    return (
      <RewardClaimScreen
        onBack={() => setCurrentScreen('dashboard')}
        walletAddress={walletAddress || undefined}
      />
    );
  }

  // Show Day Pass screen (from quiz escape button after 2 failures)
  // Routes to RewardClaimScreen where both Day Pass and Lazy Unlock are available
  if (currentScreen === 'day-pass') {
    return (
      <RewardClaimScreen
        onBack={() => setCurrentScreen('dashboard')}
        walletAddress={walletAddress || undefined}
      />
    );
  }

  // Show hardware verification screen if wallet connected but not verified
  if (walletAddress && !isVerified && verificationStatus !== 'error' && verificationStatus !== 'unverified') {
    return (
      <HardwareVerificationScreen
        onRetry={checkVerification}
        isLoading={false}
      />
    );
  }

  // Main Dashboard
  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>MINDLOCK</Text>
        <View style={styles.networkBadge}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>{NETWORK_CONFIG.network.toUpperCase()}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {!walletAddress ? (
          // Not connected state
          <>
            <Text style={styles.title}>UNLOCK{'\n'}YOUR{'\n'}FOCUS</Text>
            <Text style={styles.subtitle}>
              Lock brain-rot apps. Prove your Solana knowledge to unlock.
            </Text>

            <TouchableOpacity
              style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
              onPress={handleConnectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.connectButtonText}>CONNECT WALLET</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          // Connected state - Use new DashboardScreen
          <DashboardScreen
            walletAddress={walletAddress}
            isVerified={isVerified}
            blockedAppsCount={blockedAppsCount}
            completedSteps={completedSteps}
            onNavigate={(screen: string) => {
              if (screen === 'app-picker') {
                // Edit Apps from Dashboard — remember to come back here
                setAppPickerFromDashboard(true);
              }
              setCurrentScreen(screen as AppScreen);
            }}
            onDisconnect={handleDisconnect}
            onContinueSetup={() => {
              // Resume from saved step, not completedSteps.length
              const savedStep = getSavedSetupStep();
              setSetupStep(savedStep);
              setCurrentScreen('setup');
            }}
          />
        )}
      </View>

      {/* Footer - Only show when not connected */}
      {!walletAddress && (
        <View style={[styles.footer, { paddingBottom: safeAreaInsets.bottom + spacing.md }]}>
          <Text style={styles.footerText}>
            {'>'} POWERED BY SOLANA MOBILE
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.primary,
    marginTop: spacing.lg,
    letterSpacing: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    fontFamily: fontFamilies.monoBold,
    fontSize: fontSizes.xl,
    color: colors.primary,
    letterSpacing: 4,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.xs,
  },
  networkText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.primary,
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.heroTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 4,
    minWidth: 220,
    alignItems: 'center',
    ...shadows.glow,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderActive,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  statusLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  walletAddress: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  verifiedBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  verifiedText: {
    fontFamily: fontFamilies.monoBold,
    fontSize: fontSizes.xs,
    color: colors.textOnPrimary,
    letterSpacing: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fontFamilies.monoBold,
    fontSize: fontSizes['2xl'],
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statAction: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: colors.textMuted,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 4,
    minWidth: 220,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 1,
  },
  // Quick Action Buttons for Leaderboard & Rewards
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    alignItems: 'center',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  quickActionText: {
    fontFamily: fontFamilies.monoBold,
    fontSize: fontSizes.xs,
    color: colors.primary,
    letterSpacing: 1,
  },
});

export default App;
