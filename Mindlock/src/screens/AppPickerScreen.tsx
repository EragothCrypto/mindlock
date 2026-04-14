/**
 * AppPickerScreen - Select Apps to Block
 * 
 * Lists installed apps and allows users to select which "Brain-Rot" apps to lock.
 * Features:
 * - Pre-highlighted common brain-rot apps (TikTok, Instagram, YouTube, X)
 * - Permission Wall for Usage Access requirement
 * - MMKV storage for instant Warden access
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    NativeModules,
    Linking,
    Modal,
    ActivityIndicator,
    Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes } from '../theme/typography';
import { spacing, shadows } from '../theme';
import { getBlockedApps, setBlockedApps, setPermissionsGranted } from '../utils/storage';
import { GlowView } from '../components/ui/GlowView';
import { GridBackground } from '../components/ui/GridBackground';
import { usePressScale } from '../utils/animations';

const { MindlockWarden } = NativeModules;

// Known "Brain-Rot" apps - pre-highlighted
const BRAIN_ROT_APPS = [
    'com.zhiliaoapp.musically',      // TikTok
    'com.ss.android.ugc.trill',      // TikTok (alternate)
    'com.instagram.android',          // Instagram
    'com.twitter.android',            // X (Twitter)
    'com.google.android.youtube',     // YouTube
    'com.reddit.frontpage',           // Reddit
    'com.snapchat.android',           // Snapchat
    'com.facebook.katana',            // Facebook
];

interface InstalledApp {
    packageName: string;
    appName: string;
    isBrainRot: boolean;
}

interface AppPickerScreenProps {
    onComplete: () => void;
    onBack: () => void;
}

export function AppPickerScreen({ onComplete, onBack }: AppPickerScreenProps) {
    const [apps, setApps] = useState<InstalledApp[]>([]);
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    // Press scale for ACTIVATE WARDEN CTA
    const saveScale = useRef(new Animated.Value(1)).current;
    const { onPressIn: savePressIn, onPressOut: savePressOut } = usePressScale(saveScale);

    // Check permission on mount
    useEffect(() => {
        checkPermission();
    }, []);

    const checkPermission = async () => {
        try {
            const granted = await MindlockWarden?.hasUsageStatsPermission?.();
            setHasPermission(granted ?? false);
            if (granted) {
                setPermissionsGranted(true);
                loadInstalledApps();
            } else {
                setShowPermissionModal(true);
                setLoading(false);
            }
        } catch (error) {
            console.error('Permission check failed:', error);
            setShowPermissionModal(true);
            setLoading(false);
        }
    };

    const loadInstalledApps = async () => {
        setLoading(true);
        try {
            // Get installed apps from native module
            const installed = await MindlockWarden?.getInstalledApps?.();

            if (installed && Array.isArray(installed)) {
                const mappedApps: InstalledApp[] = installed.map((app: any) => ({
                    packageName: app.packageName,
                    appName: app.appName || app.packageName.split('.').pop(),
                    isBrainRot: BRAIN_ROT_APPS.includes(app.packageName),
                }));

                // Sort: Brain-rot apps first, then alphabetical
                mappedApps.sort((a, b) => {
                    if (a.isBrainRot && !b.isBrainRot) return -1;
                    if (!a.isBrainRot && b.isBrainRot) return 1;
                    return a.appName.localeCompare(b.appName);
                });

                setApps(mappedApps);

                // Pre-select brain-rot apps + any previously blocked
                const previouslyBlocked = getBlockedApps();
                const preSelected = new Set([
                    ...previouslyBlocked,
                    ...mappedApps.filter(a => a.isBrainRot).map(a => a.packageName),
                ]);
                setSelectedApps(preSelected);
            } else {
                // Fallback: show common brain-rot apps
                const fallbackApps: InstalledApp[] = [
                    { packageName: 'com.zhiliaoapp.musically', appName: 'TikTok', isBrainRot: true },
                    { packageName: 'com.instagram.android', appName: 'Instagram', isBrainRot: true },
                    { packageName: 'com.twitter.android', appName: 'X (Twitter)', isBrainRot: true },
                    { packageName: 'com.google.android.youtube', appName: 'YouTube', isBrainRot: true },
                    { packageName: 'com.reddit.frontpage', appName: 'Reddit', isBrainRot: true },
                    { packageName: 'com.snapchat.android', appName: 'Snapchat', isBrainRot: true },
                ];
                setApps(fallbackApps);
                setSelectedApps(new Set(fallbackApps.map(a => a.packageName)));
            }
        } catch (error) {
            console.error('Failed to load apps:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleApp = useCallback((packageName: string) => {
        setSelectedApps(prev => {
            const next = new Set(prev);
            if (next.has(packageName)) {
                next.delete(packageName);
            } else {
                next.add(packageName);
            }
            return next;
        });
    }, []);

    const handleSave = () => {
        const blockedList = Array.from(selectedApps);
        setBlockedApps(blockedList);

        // Sync to native module
        MindlockWarden?.setBlockedApps?.(blockedList);

        onComplete();
    };

    const openPermissionSettings = () => {
        // Deep-link to Usage Access settings
        Linking.openSettings();
        // Also try the specific intent for Usage Access
        Linking.openURL('package:com.mindlock').catch(() => {
            Linking.openSettings();
        });
    };

    const handlePermissionGranted = () => {
        setShowPermissionModal(false);
        checkPermission();
    };

    const renderApp = ({ item }: { item: InstalledApp }) => {
        const isSelected = selectedApps.has(item.packageName);

        const appRow = (
            <TouchableOpacity
                style={[
                    styles.appItem,
                    isSelected && styles.appItemSelected,
                    item.isBrainRot && styles.appItemBrainRot,
                ]}
                onPress={() => toggleApp(item.packageName)}
            >
                <View style={styles.appInfo}>
                    <Text style={[styles.appName, item.isBrainRot && styles.appNameBrainRot]}>
                        {item.appName}
                    </Text>
                    {item.isBrainRot && (
                        <Text style={styles.brainRotBadge}>🧠 BRAIN-ROT</Text>
                    )}
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
            </TouchableOpacity>
        );

        // GlowView only on selected (active) items — design rule compliant
        return isSelected ? (
            <GlowView color={colors.glowGreen} intensity="subtle" key={item.packageName}>
                {appRow}
            </GlowView>
        ) : appRow;
    };

    // Permission Wall Modal
    const PermissionModal = () => (
        <Modal
            visible={showPermissionModal}
            transparent
            animationType="fade"
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalIcon}>🔐</Text>
                    <Text style={styles.modalTitle}>PERMISSION REQUIRED</Text>

                    <View style={styles.modalDivider} />

                    <Text style={styles.modalText}>
                        Mindlock needs <Text style={styles.modalHighlight}>Usage Access</Text> to
                        detect when Brain-Rot apps open and intercept them.
                    </Text>

                    <Text style={styles.modalSubtext}>
                        Without this permission, the Warden cannot protect you.
                    </Text>

                    <TouchableOpacity
                        style={styles.modalButton}
                        onPress={openPermissionSettings}
                    >
                        <Text style={styles.modalButtonText}>GRANT PERMISSION</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.modalSecondary}
                        onPress={handlePermissionGranted}
                    >
                        <Text style={styles.modalSecondaryText}>I'VE GRANTED IT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onBack}>
                        <Text style={styles.modalSkip}>Skip for now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>SCANNING APPS...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <PermissionModal />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack}>
                    <Text style={styles.backButton}>← BACK</Text>
                </TouchableOpacity>
                <Text style={styles.title}>SELECT APPS TO LOCK</Text>
            </View>

            {/* Instructions */}
            <View style={styles.instructions}>
                <Text style={styles.instructionsText}>
                    Select the apps you want to lock.{'\n'}
                    <Text style={styles.brainRotHighlight}>Brain-Rot apps</Text> are pre-selected.
                </Text>
            </View>

            {/* App List */}
            <FlatList
                data={apps}
                renderItem={renderApp}
                keyExtractor={item => item.packageName}
                style={styles.list}
                contentContainerStyle={styles.listContent}
            />

            {/* Footer — ACTIVATE WARDEN is primary CTA: gradient + glow */}
            <View style={styles.footer}>
                <Text style={styles.selectedCount}>
                    {selectedApps.size} APP{selectedApps.size !== 1 ? 'S' : ''} SELECTED
                </Text>
                {selectedApps.size > 0 ? (
                    <GlowView color={colors.glowGreen} intensity="medium">
                        <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                            <TouchableOpacity
                                onPressIn={savePressIn}
                                onPressOut={savePressOut}
                                onPress={handleSave}
                                activeOpacity={1}
                            >
                                <LinearGradient
                                    colors={[colors.gradientStart, colors.gradientEnd]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.saveButton}
                                >
                                    <Text style={styles.saveButtonText}>ACTIVATE WARDEN</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </GlowView>
                ) : (
                    <View style={[styles.saveButton, styles.saveButtonDisabled]}>
                        <Text style={styles.saveButtonText}>ACTIVATE WARDEN</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
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
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.sm,
    },
    title: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.primary,
        letterSpacing: 2,
    },
    instructions: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    instructionsText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    brainRotHighlight: {
        color: colors.accent,
        fontFamily: fontFamilies.monoBold,
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: spacing.md,
    },
    appItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    appItemSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.surfaceActive,
    },
    appItemBrainRot: {
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    appInfo: {
        flex: 1,
    },
    appName: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.md,
        color: colors.textPrimary,
    },
    appNameBrainRot: {
        color: colors.accent,
    },
    brainRotBadge: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.accent,
        marginTop: spacing.xs,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    checkmark: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.md,
        color: colors.background,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    selectedCount: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.md,
        letterSpacing: 2,
    },
    saveButton: {
        paddingVertical: spacing.md,
        borderRadius: 6,
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.md,
        color: colors.textOnPrimary,
        letterSpacing: 2,
    },

    // Permission Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.surface,
        padding: spacing.xl,
        width: '100%',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.accent,
    },
    modalIcon: {
        fontSize: 48,
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.accent,
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    modalDivider: {
        width: 60,
        height: 2,
        backgroundColor: colors.accent,
        marginBottom: spacing.lg,
    },
    modalText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.md,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.md,
        lineHeight: 24,
    },
    modalHighlight: {
        color: colors.primary,
        fontFamily: fontFamilies.monoBold,
    },
    modalSubtext: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    modalButton: {
        backgroundColor: colors.accent,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.md,
        width: '100%',
        alignItems: 'center',
    },
    modalButtonText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.md,
        color: colors.background,
        letterSpacing: 2,
    },
    modalSecondary: {
        borderWidth: 2,
        borderColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.lg,
        width: '100%',
        alignItems: 'center',
    },
    modalSecondaryText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        letterSpacing: 2,
    },
    modalSkip: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
});

export default AppPickerScreen;
