/**
 * GlowView — Adds a subtle colored glow shadow behind its children.
 *
 * DESIGN RULE: Only use on active elements, CTA buttons, and key stats.
 * Not for passive/inactive cards or body content.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';

export type GlowIntensity = 'subtle' | 'medium' | 'strong';

interface GlowViewProps {
    /** Glow color — use a colors.glow* value */
    color?: string;
    /** Controls glow spread size */
    intensity?: GlowIntensity;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

const GLOW_RADIUS: Record<GlowIntensity, number> = {
    subtle: 6,
    medium: 12,
    strong: 20,
};

const GLOW_ELEVATION: Record<GlowIntensity, number> = {
    subtle: 4,
    medium: 8,
    strong: 16,
};

export function GlowView({
    color = colors.glowGreen,
    intensity = 'subtle',
    style,
    children,
}: GlowViewProps) {
    return (
        <View
            style={[
                {
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: GLOW_RADIUS[intensity],
                    elevation: GLOW_ELEVATION[intensity],
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}
