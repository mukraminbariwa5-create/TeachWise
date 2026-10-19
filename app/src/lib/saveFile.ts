import { Platform, Share } from 'react-native';

/** Computer: downloads the file. Phone: opens the share sheet with its contents. */
export async function saveFile(filename: string, content: string, mime: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Excel needs the UTF-8 marker to show names like "Peñaflor" correctly.
    const body = mime.startsWith('text/csv') && !content.startsWith('\uFEFF') ? `\uFEFF${content}` : content;
    const url = URL.createObjectURL(new Blob([body], { type: mime }));
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
