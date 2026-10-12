import { Platform, Share } from 'react-native';

/** Computer: downloads the file. Phone: opens the share sheet with its contents. */
export async function saveFile(filename: string, content: string, mime: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    await Share.share({ title: filename, message: content });
  }
}

export const today = () => new Date().toISOString().slice(0, 10);
