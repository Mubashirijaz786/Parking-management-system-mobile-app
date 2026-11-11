import TextRecognition from '@react-native-ml-kit/text-recognition';
import { normalizePlate } from '@/src/utils/format';

const looksLikePlate = (value: string) => value.length >= 4 && value.length <= 12 && /[A-Z]/.test(value) && /\d/.test(value);

export async function readPlateFromImage(uri: string): Promise<string | null> {
  const result = await TextRecognition.recognize(uri);
  const raw = result.text.toUpperCase().replace(/[^A-Z0-9\s-]/g, ' ');
  const words = raw.split(/[\s-]+/).filter(Boolean);
  const candidates = [...words];
  for (let index = 0; index < words.length - 1; index += 1) candidates.push(`${words[index]}${words[index + 1]}`);
  for (const candidate of candidates) {
    const normalized = normalizePlate(candidate);
    if (looksLikePlate(normalized)) return normalized;
  }
  return null;
}
