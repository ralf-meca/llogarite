import TextRecognition, { TextRecognitionScript, type TextRecognitionResult } from '@react-native-ml-kit/text-recognition';

export async function recognizeReceipt(photoUri: string): Promise<TextRecognitionResult> {
  try {
    const result = await TextRecognition.recognize(photoUri, TextRecognitionScript.LATIN);
    console.log('[OCR raw text]', JSON.stringify(result.text));
    return result;
  } catch {
    throw new Error('Leximi i faturës dështoi. Provo përsëri me një foto më të qartë.');
  }
}
