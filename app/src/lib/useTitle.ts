import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Sets the browser tab title, e.g. "Settings · TeachWise". No-op on phones. */
export function useTitle(title?: string) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = title ? `${title} · TeachWise` : 'TeachWise';
  }, [title]);
}
