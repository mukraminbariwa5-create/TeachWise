// On the web (react-native-web), Pressable also reports hover and focus to its style
// and children callbacks. React Native's own types only know about `pressed`.
import 'react-native';

declare module 'react-native' {
  interface PressableStateCallbackType {
    readonly hovered?: boolean;
    readonly focused?: boolean;
  }
}
