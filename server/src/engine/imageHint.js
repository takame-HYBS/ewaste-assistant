// Optional image-classification hook.
//
// By default this does nothing: photos are stored as reference material and the recommendation comes
// from the questionnaire. To enable a category hint, point CLASSIFIER_URL at a service that accepts a
// multipart POST with an `image` field and replies with JSON: { "label": "laptop", "confidence": 0.87 }.
// (Any pretrained image-classification API can sit behind a thin adapter that returns this shape.)
//
// The result is a SUGGESTION shown to the user to help pick a device category. It is never fed into
// the recommendation engine and never claims to detect internal damage.
import { config } from '../config.js';

const LABEL_TO_CATEGORY = [
  [/phone|smartphone|cellular|mobile/i, 'phone'],
  [/laptop|notebook|computer/i, 'laptop'],
  [/tablet|ipad/i, 'tablet'],
  [/mouse|keyboard|charger|cable|headphone|earphone|speaker|webcam|adapter/i, 'peripheral'],
];

export async function classifyImage(buffer, mimeType) {
  if (!config.classifierUrl) return null;
  try {
    const form = new FormData();
    form.append('image', new Blob([buffer], { type: mimeType }), 'device');
    const res = await fetch(config.classifierUrl, {
      method: 'POST',
      body: form,
      headers: config.classifierKey ? { Authorization: `Bearer ${config.classifierKey}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const label = typeof data.label === 'string' ? data.label.slice(0, 80) : null;
    const confidence = Number(data.confidence);
    if (!label) return null;
    const category = LABEL_TO_CATEGORY.find(([re]) => re.test(label))?.[1] || null;
    return {
      label,
      category,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null,
      note: 'Automatic suggestion only. Please confirm the category yourself.',
    };
  } catch {
    return null; // classifier down or slow: the assessment still works without it
  }
}
