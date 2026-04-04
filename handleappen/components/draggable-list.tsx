import React, { useCallback, useRef, useState } from 'react';
import { View, ScrollView, Platform, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface Props<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  onReorder: (from: number, to: number) => void;
  itemHeight?: number; // fixed height per item for simpler math
}

const ITEM_HEIGHT = 72;

export function DraggableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  itemHeight = ITEM_HEIGHT,
}: Props<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activeIndex = useRef<number | null>(null);
  const translateY = useSharedValue(0);
  const startY = useRef(0);

  const reorder = useCallback(
    (from: number, to: number) => {
      if (from !== to) onReorder(from, to);
      setDraggingIndex(null);
      setHoverIndex(null);
      activeIndex.current = null;
      translateY.value = 0;
    },
    [onReorder]
  );

  const getHoverIndex = (startIdx: number, dy: number) => {
    const raw = startIdx + Math.round(dy / itemHeight);
    return Math.max(0, Math.min(data.length - 1, raw));
  };

  // Web fallback: simple up/down arrows
  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: 12 }}>
        {data.map((item, index) => (
          <View key={keyExtractor(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>{renderItem(item, false)}</View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: 0 }}>
      {data.map((item, index) => {
        const isDragging = draggingIndex === index;
        const isHovered = hoverIndex === index && draggingIndex !== null && draggingIndex !== index;

        const panGesture = Gesture.Pan()
          .onStart(() => {
            'worklet';
            runOnJS(setDraggingIndex)(index);
            runOnJS(setHoverIndex)(index);
            activeIndex.current = index;
            startY.current = 0;
            translateY.value = 0;
          })
          .onUpdate((e) => {
            'worklet';
            translateY.value = e.translationY;
            const hover = Math.max(0, Math.min(data.length - 1,
              index + Math.round(e.translationY / itemHeight)
            ));
            runOnJS(setHoverIndex)(hover);
          })
          .onEnd((e) => {
            'worklet';
            const to = Math.max(0, Math.min(data.length - 1,
              index + Math.round(e.translationY / itemHeight)
            ));
            translateY.value = withSpring(0, { damping: 20 });
            runOnJS(reorder)(index, to);
          });

        const animatedStyle = useAnimatedStyle(() => {
          if (!isDragging) return {};
          return {
            transform: [{ translateY: translateY.value }],
            zIndex: 100,
            shadowColor: '#00362a',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          };
        });

        return (
          <View
            key={keyExtractor(item)}
            style={{
              marginBottom: 12,
              opacity: isDragging ? 0.95 : 1,
              ...(isHovered ? { borderTopWidth: 2, borderTopColor: '#006947' } : {}),
            }}
          >
            <GestureDetector gesture={panGesture}>
              <Animated.View style={animatedStyle}>
                {renderItem(item, isDragging)}
              </Animated.View>
            </GestureDetector>
          </View>
        );
      })}
    </View>
  );
}
