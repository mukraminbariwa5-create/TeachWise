import { tr } from './i18n';

/** "What's new" items per version, newest first. Shown once after an update. */
export function changelog(): Record<string, string[]> {
  return {
    '1.0.0': [
      tr('Settings: appearance (System, Light, Dark), language, notifications and privacy in one place.', 'Settings: itsura (System, Light, Dark), wika, notifications at privacy sa iisang lugar.'),
      tr('See and sign out your devices, download your data, or delete your account.', 'Tingnan at i-sign out ang mga device mo, i-download ang data mo, o burahin ang account.'),
      tr('Help center with quick answers, “Contact the admin” and “Report a problem”.', 'Help center na may mabilis na sagot, “Makipag-ugnayan sa admin” at “Mag-report ng problema”.'),
      tr('Push notifications when an evaluation opens and a day before it closes.', 'Push notification kapag nagbukas ang evaluation at isang araw bago ito magsara.'),
      tr('Pages open instantly with your last saved data, even offline.', 'Agad bumubukas ang mga page gamit ang huling naka-save na data, kahit offline.'),
    ],
  };
}
