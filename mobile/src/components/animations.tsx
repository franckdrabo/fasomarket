import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  SlideInUp,
  SlideInDown,
  SlideOutDown,
  interpolate,
  Extrapolate,
  type SharedValue,
} from 'react-native-reanimated';

// ─── Constantes d'animation ─────────────────────────────────────────────────
const SPRING_CONFIG = {
  damping: 12,
  stiffness: 200,
  mass: 0.5,
};

const TIMING_CONFIG = {
  duration: 300,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

const BOUNCE_CONFIG = {
  damping: 8,
  stiffness: 300,
  mass: 0.8,
};

// ─── Transitions d'écran ────────────────────────────────────────────────────

export { FadeIn, FadeOut, SlideInRight, SlideOutRight, SlideInUp, SlideInDown, SlideOutDown };

// ─── AnimatedPressable avec scale ─────────────────────────────────────────────

interface AnimatedPressableProps {
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
  scaleTo?: number;
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  children,
  style,
  disabled,
  scaleTo = 0.95,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(scaleTo, SPRING_CONFIG);
  }

  function handlePressOut() {
    scale.value = withSpring(1, SPRING_CONFIG);
  }

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── FadeInView (apparition progressive) ──────────────────────────────────────

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: any;
}

export function FadeInView({ children, delay = 0, duration = 400, style }: FadeInViewProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(duration).delay(delay)}
      exiting={FadeOut.duration(duration)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ─── SlideInView (glissement depuis un côté) ─────────────────────────────────

interface SlideInViewProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'right' | 'left' | 'up' | 'down';
  style?: any;
}

export function SlideInView({ children, delay = 0, direction = 'up', style }: SlideInViewProps) {
  const entering = {
    right: SlideInRight.duration(400).delay(delay),
    left: SlideInRight.duration(400).delay(delay).withInitialValues({ transform: [{ translateX: -100 }] }),
    up: SlideInUp.duration(400).delay(delay),
    down: SlideInDown.duration(400).delay(delay),
  };

  const exiting = {
    right: SlideOutRight.duration(300),
    left: SlideOutRight.duration(300),
    up: SlideOutDown.duration(300),
    down: SlideOutDown.duration(300),
  };

  return (
    <Animated.View
      entering={entering[direction]}
      exiting={exiting[direction]}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ─── AnimatedHeart (cœur avec bounce) ─────────────────────────────────────────

interface AnimatedHeartProps {
  active: boolean;
  size?: number;
  onToggle?: () => void;
  style?: any;
}

export function AnimatedHeart({ active, size = 24, onToggle, style }: AnimatedHeartProps) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  function handlePress() {
    if (active) {
      // Unfavorite: petit pop puis retour
      scale.value = withSequence(
        withSpring(0.8, BOUNCE_CONFIG),
        withSpring(1, SPRING_CONFIG),
      );
    } else {
      // Favorite: big bounce + léger rotate
      scale.value = withSequence(
        withSpring(1.4, BOUNCE_CONFIG),
        withSpring(0.9, SPRING_CONFIG),
        withSpring(1.2, { ...BOUNCE_CONFIG, stiffness: 400 }),
        withSpring(1, SPRING_CONFIG),
      );
      rotation.value = withSequence(
        withTiming(-10, { duration: 100 }),
        withTiming(10, { duration: 100 }),
        withTiming(0, { duration: 100 }),
      );
    }
    onToggle?.();
  }

  // Redéclencher l'animation si l'état actif change depuis l'extérieur
  useEffect(() => {
    if (!active) return;
    scale.value = withSequence(
      withSpring(1.2, { ...BOUNCE_CONFIG, stiffness: 400 }),
      withSpring(1, SPRING_CONFIG),
    );
  }, [active]);

  const iconColor = active ? colors?.error || '#E74C3C' : colors?.textOnPrimary || '#fff';

  return (
    <AnimatedPressable onPress={handlePress} style={style}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={active ? 'heart' : 'heart-outline'}
          size={size}
          color={iconColor}
        />
      </Animated.View>
    </AnimatedPressable>
  );
}

// ─── StaggeredList (liste avec entrée progressive) ──────────────────────────

interface StaggeredListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  style?: any;
}

export function StaggeredList({ children, staggerDelay = 80, style }: StaggeredListProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={style}
    >
      {React.Children.map(children, (child, index) => (
        <Animated.View
          key={index}
          entering={SlideInUp
            .duration(400)
            .delay(staggerDelay * index)
            .springify()
          }
        >
          {child}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// ─── SkeletonLoader (animation de chargement) ────────────────────────────────

export function SkeletonLoader({ width = '100%', height = 20, style }: { width?: any; height?: number; style?: any }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      );
    }, 1600);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: '#E8D5C4',
          borderRadius: 6,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// ─── AnimatedScreenWrapper (transition d'écran) ────────────────────────────

interface AnimatedScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
}

export function AnimatedScreenWrapper({ children, style }: AnimatedScreenWrapperProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}

// ─── ParallaxImage (effet parallaxe au scroll) ──────────────────────────────

interface ParallaxImageProps {
  uri: string;
  height: number;
  scrollOffset: SharedValue<number>;
  style?: any;
}

export function ParallaxImage({ uri, height, scrollOffset, style }: ParallaxImageProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollOffset.value,
      [-height, 0, height],
      [-height * 0.3, 0, height * 0.1],
      Extrapolate.CLAMP,
    );
    const scale = interpolate(
      scrollOffset.value,
      [-height, 0, height],
      [1.3, 1, 0.95],
      Extrapolate.CLAMP,
    );

    return {
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <Animated.Image
      source={{ uri }}
      style={[{ width: '100%', height, position: 'absolute' }, animatedStyle, style]}
      resizeMode="cover"
    />
  );
}
