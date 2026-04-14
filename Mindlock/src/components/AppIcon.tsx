/**
 * AppIcon Component
 * 
 * Renders custom Mindlock icons with consistent sizing.
 * Replaces emoji usage throughout the app.
 */

import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { IconMap, IconName } from '../assets/icons';

interface AppIconProps {
    /** Icon name from IconMap */
    name: IconName;
    /** Size in pixels (width and height) */
    size?: number;
    /** Optional custom style */
    style?: StyleProp<ImageStyle>;
    /** Tint color (optional, for monochrome effects) */
    tint?: string;
}

/**
 * Renders a custom Mindlock icon
 * 
 * @example
 * <AppIcon name="diamond" size={24} />
 * <AppIcon name="fire" size={18} tint="#F59E0B" />
 */
export function AppIcon({ name, size = 24, style, tint }: AppIconProps) {
    const source = IconMap[name];

    if (!source) {
        console.warn(`AppIcon: Unknown icon name "${name}"`);
        return null;
    }

    return (
        <Image
            source={source}
            style={[
                {
                    width: size,
                    height: size,
                    resizeMode: 'contain',
                },
                tint && { tintColor: tint },
                style,
            ]}
        />
    );
}

// Pre-defined sizes for consistency
export const IconSizes = {
    xs: 12,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
    xxl: 64,
} as const;

export default AppIcon;
