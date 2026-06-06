/**
 * src/components/ChatInputBar.tsx
 *
 * Works with: softwareKeyboardLayoutMode = "adjustNothing" in app.json
 *
 * Android: adjustNothing means the OS does nothing when keyboard opens.
 *          We listen for the keyboard event and set marginBottom = keyboardHeight
 *          so the bar lifts exactly to the top of the keyboard.
 *
 * iOS:     keyboardWillShow fires before the keyboard appears — smooth animation.
 *          No KeyboardAvoidingView needed here since chat.tsx handles iOS KAV.
 *
 * Keyboard closed: marginBottom = TAB_OFFSET to clear the floating tab bar.
 */

import { COLORS, RADIUS, FONTS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Floating tab bar: position absolute, bottom: 10, height: 70
const TAB_OFFSET = 80;

interface ChatInputBarProps {
  value:        string;
  onChangeText: (text: string) => void;
  onSend:       () => void;
  loading?:     boolean;
  placeholder?: string;
  minLength?:   number;
}

export default function ChatInputBar({
  value,
  onChangeText,
  onSend,
  loading     = false,
  placeholder = 'Ask a question…',
  minLength   = 1,
}: ChatInputBarProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const canSend = value.trim().length >= minLength && !loading;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // adjustNothing = OS does zero keyboard handling.
  // marginBottom lifts the bar above the keyboard manually.
  // When keyboard is closed, TAB_OFFSET clears the floating tab bar.
  const bottomOffset = keyboardHeight > 0 ? keyboardHeight : TAB_OFFSET;

  return (
    <View style={[styles.wrapper, { marginBottom: bottomOffset }]}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
          onPress={onSend}
          disabled={!canSend}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={17} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderTopWidth:  1,
    borderTopColor:  COLORS.border,
    paddingTop:      10,
    paddingBottom:   8,
    elevation:       10,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.06,
    shadowRadius:    4,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    gap:               10,
    paddingHorizontal: 16,
  },
  input: {
    flex:              1,
    backgroundColor:   COLORS.background,
    borderRadius:      RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontSize:          14,
    fontFamily:        FONTS.regular,
    color:             COLORS.textPrimary,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    maxHeight:         100,
    minHeight:         44,
  },
  sendBtn: {
    width:           46,
    height:          46,
    borderRadius:    15,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       6,
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.3,
    shadowRadius:    4,
  },
  sendBtnOff: {
    backgroundColor: COLORS.primaryMid,
    elevation:       0,
    shadowOpacity:   0,
  },
});