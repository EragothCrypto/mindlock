/**
 * GridBackground — Subtle circuit-board grid pattern behind all screen content.
 *
 * Renders at 4–5% opacity — invisible when focused on content,
 * but adds depth and texture to the dark background.
 * Position absolute — drop inside any screen's root View.
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Defs, Pattern, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';

const { width, height } = Dimensions.get('screen');
const GRID_SIZE = 32; // px between grid lines

export function GridBackground() {
    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Svg width={width} height={height} style={{ opacity: 0.045 }}>
                <Defs>
                    <Pattern
                        id="grid"
                        x="0"
                        y="0"
                        width={GRID_SIZE}
                        height={GRID_SIZE}
                        patternUnits="userSpaceOnUse"
                    >
                        {/* Vertical line */}
                        <Line
                            x1={GRID_SIZE}
                            y1="0"
                            x2={GRID_SIZE}
                            y2={GRID_SIZE}
                            stroke={colors.primary}
                            strokeWidth="0.5"
                        />
                        {/* Horizontal line */}
                        <Line
                            x1="0"
                            y1={GRID_SIZE}
                            x2={GRID_SIZE}
                            y2={GRID_SIZE}
                            stroke={colors.primary}
                            strokeWidth="0.5"
                        />
                    </Pattern>
                </Defs>
                <Rect width={width} height={height} fill="url(#grid)" />
            </Svg>
        </View>
    );
}
