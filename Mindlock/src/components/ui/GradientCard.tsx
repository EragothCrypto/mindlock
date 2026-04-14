/**
 * GradientCard — Card with a gradient border (1–2dp) and dark fill.
 *
 * DESIGN RULE: Gradient is on the BORDER only, not the background.
 * Interior always uses a dark surface fill.
 * Use on: active stat cards, user's leaderboard row, primary CTA containers.
 * Do NOT use on passive/inactive content cards.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../../theme/colors';

interface GradientCardProps {
    /** Gradient border colors — defaults to green→cyan */
    borderColors?: string[];
    /** Border width in dp — keep to 1–2dp per design rules */
    borderWidth?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
    innerStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

export function GradientCard({
    borderColors = [colors.gradientStart, colors.gradientEnd],
    borderWidth = 1,
    borderRadius = 6,
    style,
    innerStyle,
    children,
}: GradientCardProps) {
    return (
        <LinearGradient
            colors={borderColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
                { borderRadius: borderRadius + borderWidth, padding: borderWidth },
                style,
            ]}
        >
            <View
                style={[
                    {
                        borderRadius,
                        backgroundColor: colors.surface,
                        overflow: 'hidden',
                    },
                    innerStyle,
                ]}
            >
                {children}
            </View>
        </LinearGradient>
    );
}
