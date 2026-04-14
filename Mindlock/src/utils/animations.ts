/**
 * animations.ts — Mindlock Animation Utilities
 *
 * Hard rules (per design system):
 *  - Press interactions:  150ms
 *  - Mount animations:    200–250ms
 *  - Stagger offset:       60ms per child
 *  - Pulses only:        1800ms repeat
 *  - Nothing exceeds 300ms (except deliberate pulses)
 */

import { Animated, Easing } from 'react-native';

// ─── Fade + Slide Up (mount animation) ────────────────────────────────────────

/**
 * Animate a component into view: opacity 0→1 + translateY 20→0
 * @param fadeRef  Animated.Value starting at 0
 * @param slideRef Animated.Value starting at 20
 * @param delay    Optional delay in ms (use 60ms per stagger step)
 */
export function fadeInUp(
    fadeRef: Animated.Value,
    slideRef: Animated.Value,
    delay = 0,
): Animated.CompositeAnimation {
    return Animated.parallel([
        Animated.timing(fadeRef, {
            toValue: 1,
            duration: 220,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }),
        Animated.timing(slideRef, {
            toValue: 0,
            duration: 220,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }),
    ]);
}

/** Create the Animated.Values needed for fadeInUp */
export function createFadeInUpValues(): {
    opacity: Animated.Value;
    translateY: Animated.Value;
} {
    return {
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(20),
    };
}

/**
 * Stagger-animate an array of fadeInUp Animated pairs.
 * @param pairs   Array of {opacity, translateY} values (from createFadeInUpValues)
 * @param baseDelay Optional initial delay before stagger starts
 */
export function staggerFadeInUp(
    pairs: Array<{ opacity: Animated.Value; translateY: Animated.Value }>,
    baseDelay = 0,
): Animated.CompositeAnimation {
    const STAGGER_OFFSET = 60; // ms between each child
    const animations = pairs.map((pair, i) =>
        fadeInUp(pair.opacity, pair.translateY, baseDelay + i * STAGGER_OFFSET),
    );
    return Animated.parallel(animations);
}

// ─── Press Scale (interaction feedback) ───────────────────────────────────────

/**
 * Returns handlers and animated style for a press scale effect.
 * Scale: 1.0 → 0.96 on press, 0.96 → 1.0 on release.
 */
export function usePressScale(scaleRef: Animated.Value) {
    const onPressIn = () => {
        Animated.spring(scaleRef, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
            bounciness: 0,
        }).start();
    };

    const onPressOut = () => {
        Animated.spring(scaleRef, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    return { onPressIn, onPressOut };
}

// ─── Pulse Glow (active timers / CTA attention) ────────────────────────────────

/**
 * Looping opacity pulse: 0.5 → 1.0 → 0.5 over 1800ms.
 * Use ONLY on: active timer borders, CTA glow halos.
 */
export function startPulse(ref: Animated.Value): void {
    Animated.loop(
        Animated.sequence([
            Animated.timing(ref, {
                toValue: 1,
                duration: 900,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(ref, {
                toValue: 0.4,
                duration: 900,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
        ]),
    ).start();
}

// ─── Animated Counter (high-value numbers) ────────────────────────────────────

/**
 * Animates a number from 0 to `target` over 250ms.
 * Use the returned ref as `Math.round(ref)` in display.
 */
export function animateCounter(
    ref: Animated.Value,
    target: number,
): void {
    Animated.timing(ref, {
        toValue: target,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // must be false for non-transform/opacity
    }).start();
}
