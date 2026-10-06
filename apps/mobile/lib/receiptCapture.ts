import type { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import * as FileSystem from 'expo-file-system/legacy';
import type { ParsedReceipt } from './receiptParser';

// Development builds only. Every receipt read from a photo is kept on the phone - what
// the text recognition saw, what the parser made of it, and the photo itself - so the
// parser can be scored against real receipts and fixed without guessing.
// `npm run receipts:pull` brings them over to the computer.
const CAPTURE_DIRECTORY = `${FileSystem.documentDirectory ?? ''}receipt-captures/`;

// Resolves to how many receipts are now kept, or null when nothing was saved. Never
// rejects: a failed capture must not get in the way of the scan it is recording.
export async function captureReceipt(
  photoUri: string,
  ocr: TextRecognitionResult,
  parsed: ParsedReceipt | null,
): Promise<number | null> {
  if (!__DEV__ || !FileSystem.documentDirectory) {
    return null;
  }
  try {
    await FileSystem.makeDirectoryAsync(CAPTURE_DIRECTORY, { intermediates: true });
    // Sorts by time, and is safe as a file name.
    const id = new Date().toISOString().replace(/[:.]/g, '-');
    await FileSystem.writeAsStringAsync(
      `${CAPTURE_DIRECTORY}${id}.json`,
      JSON.stringify({ id, capturedAt: new Date().toISOString(), ocr, parsed }),
    );
    // The photo is for the person labelling it; a receipt whose photo could not be
    // copied is still worth having.
    await FileSystem.copyAsync({ from: photoUri, to: `${CAPTURE_DIRECTORY}${id}.jpg` }).catch(() => undefined);
    const files = await FileSystem.readDirectoryAsync(CAPTURE_DIRECTORY);
    return files.filter((name) => name.endsWith('.json')).length;
  } catch (error) {
    console.log('[receipt capture failed]', error);
    return null;
  }
}
