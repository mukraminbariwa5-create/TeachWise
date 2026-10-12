import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

export type IconName =
  | 'menu' | 'home' | 'user' | 'chat' | 'clipboard' | 'clock' | 'settings' | 'search' | 'bell'
  | 'book' | 'chevronDown' | 'arrowLeft' | 'check' | 'send' | 'sparkle' | 'close' | 'refresh'
  | 'trash' | 'logout' | 'more' | 'plus' | 'chevronRight' | 'sun' | 'moon' | 'calendar' | 'checkCircle' | 'lock' | 'eye' | 'eyeOff' | 'arrowUp' | 'wifiOff' | 'filter' | 'help' | 'globe' | 'shield' | 'info' | 'download' | 'monitor' | 'mail' | 'bug' | 'users' | 'layers' | 'list' | 'barChart' | 'upload' | 'edit' | 'key' | 'palette' | 'printer' | 'inbox' | 'activity' | 'phone' | 'grid' | 'settings2';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Line icons used across TeachWise (same set as the design). */
export function Icon({ name, size = 24, color, strokeWidth = 1.7 }: Props) {
  color = color ?? colors.text;
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {name === 'menu' && <Path d="M4 7h16M8 12h12M4 17h16" {...p} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'arrowUp' && <Path d="M12 19V5M6 11l6-6 6 6" {...p} />}
      {name === 'help' && (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8M12 17h.01" {...p} />
        </>
      )}
      {name === 'globe' && (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" {...p} />
        </>
      )}
      {name === 'shield' && <Path d="M12 3 5 6v5.5c0 4.3 3 8 7 9.5 4-1.5 7-5.2 7-9.5V6l-7-3Zm-3 9 2 2 4-4" {...p} />}
      {name === 'info' && (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 11v6M12 7.5h.01" {...p} />
        </>
      )}
      {name === 'download' && <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...p} />}
      {name === 'upload' && <Path d="M12 16V5M7 10l5-5 5 5M5 20h14" {...p} />}
      {name === 'monitor' && (
        <>
          <Rect x="3" y="4" width="18" height="12" rx="2.5" {...p} />
          <Path d="M8 20h8M12 16v4" {...p} />
        </>
      )}
      {name === 'phone' && (
        <>
          <Rect x="7" y="3" width="10" height="18" rx="2.5" {...p} />
          <Path d="M11 17.5h2" {...p} />
        </>
      )}
      {name === 'mail' && (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="2.5" {...p} />
          <Path d="m4 7 8 6 8-6" {...p} />
        </>
      )}
      {name === 'bug' && <Path d="M9 7.5V6a3 3 0 0 1 6 0v1.5M6.5 10h11v4a5.5 5.5 0 0 1-11 0v-4ZM12 10v9M4 12h2.5M17.5 12H20M4.5 18l2.3-1.3M19.5 18l-2.3-1.3M5 7l2 1.6M19 7l-2 1.6" {...p} />}
      {name === 'users' && <Path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.7c1.8.7 3 2.4 3 5.3" {...p} />}
      {name === 'layers' && <Path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" {...p} />}
      {name === 'list' && <Path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" {...p} />}
      {name === 'grid' && <Path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" {...p} />}
      {name === 'barChart' && <Path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" {...p} />}
      {name === 'activity' && <Path d="M3 12h4l3-7 4 14 3-7h4" {...p} />}
      {name === 'edit' && <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4" {...p} />}
      {name === 'key' && <Path d="M14.5 9.5a4.5 4.5 0 1 1-1.3-3.2 4.5 4.5 0 0 1 1.3 3.2ZM13 13l7 7M17 17l2-2M15 15l2-2" {...p} />}
      {name === 'palette' && <Path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.7-1.1-2.9 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3ZM7.5 12h.01M9 7.5h.01M15 7.5h.01" {...p} />}
      {name === 'printer' && <Path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z" {...p} />}
      {name === 'inbox' && <Path d="M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8Z" {...p} />}
      {name === 'filter' && <Path d="M4 6h16M7 12h10M10 18h4" {...p} />}
      {name === 'wifiOff' && <Path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.6M19 12.9a10 10 0 0 0-2.4-1.7M2 9a15 15 0 0 1 4.6-2.9M22 9a15 15 0 0 0-10.5-4M12 20h.01" {...p} />}
      {name === 'chevronRight' && <Path d="m9 6 6 6-6 6" {...p} />}
      {name === 'lock' && (
        <>
          <Rect x="4.5" y="10.5" width="15" height="10" rx="2.5" {...p} />
          <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" {...p} />
        </>
      )}
      {name === 'eye' && (
        <>
          <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...p} />
          <Circle cx="12" cy="12" r="3" {...p} />
        </>
      )}
      {name === 'eyeOff' && (
        <>
          <Path d="M3 3l18 18M10.6 5.6A9.7 9.7 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3 3.8M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2" {...p} />
          <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" {...p} />
        </>
      )}
      {name === 'moon' && <Path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" {...p} />}
      {name === 'sun' && (
        <>
          <Circle cx="12" cy="12" r="4" {...p} />
          <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...p} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3.5" y="5" width="17" height="15.5" rx="3" {...p} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...p} />
        </>
      )}
      {name === 'checkCircle' && (
        <>
          <Circle cx="12" cy="12" r="9.5" {...p} />
          <Path d="m7.5 12.5 3 3 6-6.5" {...p} />
        </>
      )}
      {name === 'home' && (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...p} />
          <Path d="M5 9.5V20h14V9.5" {...p} />
          <Path d="M10 20v-6h4v6" {...p} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="12" r="9.5" {...p} />
          <Circle cx="12" cy="10" r="3.2" {...p} />
          <Path d="M6.5 18.6c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3" {...p} />
        </>
      )}
      {name === 'chat' && (
        <>
          <Path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12Z" {...p} />
          <Path d="M8 10h8M8 14h5" {...p} />
        </>
      )}
      {name === 'clipboard' && (
        <>
          <Rect x="5" y="4" width="14" height="17" rx="2" {...p} />
          <Path d="M9 4V3h6v1" {...p} />
          <Path d="m9 13 2 2 4-4" {...p} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 7v5l3 2" {...p} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx="12" cy="12" r="3" {...p} />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
            {...p}
          />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="7" {...p} />
          <Path d="m20 20-3.5-3.5" {...p} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...p} />
          <Path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" {...p} />
        </>
      )}
      {name === 'book' && (
        <>
          <Path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h14" {...p} />
          <Path d="M9 7h7M9 11h5" {...p} />
        </>
      )}
      {name === 'chevronDown' && <Path d="m6 9 6 6 6-6" {...p} />}
      {name === 'arrowLeft' && <Path d="M19 12H5M12 19l-7-7 7-7" {...p} />}
      {name === 'check' && <Path d="m5 12 5 5 9-10" {...p} />}
      {name === 'send' && (
        <>
          <Path d="M22 2 11 13" {...p} />
          <Path d="M22 2 15 22l-4-9-9-4Z" {...p} />
        </>
      )}
      {name === 'sparkle' && <Path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7Z" {...p} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...p} />}
      {name === 'refresh' && (
        <>
          <Path d="M20 11a8 8 0 1 0-2.3 5.7" {...p} />
          <Path d="M20 4v7h-7" {...p} />
        </>
      )}
      {name === 'trash' && <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" {...p} />}
      {name === 'logout' && <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" {...p} />}
      {name === 'more' && (
        <>
          <Circle cx="12" cy="5" r="1.9" fill={color} />
          <Circle cx="12" cy="12" r="1.9" fill={color} />
          <Circle cx="12" cy="19" r="1.9" fill={color} />
        </>
      )}
    </Svg>
  );
}
