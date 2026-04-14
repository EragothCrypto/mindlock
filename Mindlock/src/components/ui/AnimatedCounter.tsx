/**
 * AnimatedCounter — Counts up from 0 to a target value on mount.
 *
 * DESIGN RULE: Use only on high-value numbers (SKR amounts, Focus Score,
 * scholarship pool balance). Duration: 250ms.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Text, TextStyle, StyleProp } from 'react-native';
import { animateCounter } from '../../utils/animations';

interface AnimatedCounterProps {
    value: number;
    /** Number of decimal places to show */
    decimals?: number;
    /** Text style for the number */
    style?: StyleProp<TextStyle>;
    /** Optional prefix (e.g. "$") */
    prefix?: string;
    /** Optional suffix (e.g. " SKR") */
    suffix?: string;
}

export function AnimatedCounter({
    value,
    decimals = 0,
    style,
    prefix = '',
    suffix = '',
}: AnimatedCounterProps) {
    const animRef = useRef(new Animated.Value(0));
    const [displayValue, setDisplayValue] = React.useState(0);

    useEffect(() => {
        animRef.current.addListener(({ value: v }) => {
            setDisplayValue(v);
        });
        animateCounter(animRef.current, value);
        return () => animRef.current.removeAllListeners();
    }, [value]);

    const formatted = decimals > 0
        ? displayValue.toFixed(decimals)
        : Math.round(displayValue).toString();

    return (
        <Text style={style}>
            {prefix}{formatted}{suffix}
        </Text>
    );
}
