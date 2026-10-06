import TextRecognition, { TextRecognitionScript, type TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { tr } from './i18n';

export async function recognizeReceipt(photoUri: string): Promise<TextRecognitionResult> {
  try {
    const result = await TextRecognition.recognize(photoUri, TextRecognitionScript.LATIN);
    console.log('[OCR raw text]', JSON.stringify(result.text));
    return result;
  } catch {
    throw new Error(tr('api.receiptReadFailed'));
  }
}
