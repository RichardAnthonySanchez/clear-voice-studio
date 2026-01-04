// Correction patterns and rules for dictation cleanup
export interface CorrectionResult {
  original: string;
  corrected: string;
  changes: Change[];
}

export interface Change {
  type: 'punctuation' | 'filler' | 'casing' | 'spacing' | 'boundary';
  description: string;
  position: number;
}

// Common filler words and phrases to remove
const FILLER_PATTERNS = [
  /\b(um+|uh+|er+|ah+|like,?\s)/gi,
  /\b(you know,?\s)/gi,
  /\b(basically,?\s)/gi,
  /\b(literally,?\s)/gi,
  /\b(actually,?\s)/gi,
  /\b(sort of|kind of)\s/gi,
  /\b(I mean,?\s)/gi,
];

// Sentence boundary indicators based on semantic patterns
const BOUNDARY_TRIGGERS = [
  'however', 'therefore', 'moreover', 'furthermore', 'additionally',
  'consequently', 'nevertheless', 'meanwhile', 'subsequently',
  'in addition', 'as a result', 'on the other hand', 'in conclusion',
  'first', 'second', 'third', 'finally', 'next', 'then', 'also',
  'but', 'and then', 'so then', 'after that'
];

// Words that typically start new sentences
const SENTENCE_STARTERS = [
  'i', 'we', 'they', 'he', 'she', 'it', 'the', 'this', 'that', 'there',
  'what', 'when', 'where', 'why', 'how', 'who', 'which',
  'my', 'our', 'your', 'his', 'her', 'their'
];

// Apply rule-based corrections
export function applyCorrections(text: string, similarities: number[] = []): CorrectionResult {
  const changes: Change[] = [];
  let result = text;
  let position = 0;

  // Step 1: Remove filler words
  FILLER_PATTERNS.forEach(pattern => {
    const matches = result.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match.index !== undefined) {
        changes.push({
          type: 'filler',
          description: `Removed filler: "${match[0].trim()}"`,
          position: match.index
        });
      }
    }
    result = result.replace(pattern, '');
  });

  // Step 2: Fix multiple spaces
  const multiSpaceMatches = [...result.matchAll(/\s{2,}/g)];
  multiSpaceMatches.forEach(match => {
    if (match.index !== undefined) {
      changes.push({
        type: 'spacing',
        description: 'Fixed multiple spaces',
        position: match.index
      });
    }
  });
  result = result.replace(/\s{2,}/g, ' ');

  // Step 3: Infer sentence boundaries
  result = inferSentenceBoundaries(result, changes);

  // Step 4: Fix casing after periods
  result = result.replace(/\.\s+([a-z])/g, (match, letter) => {
    changes.push({
      type: 'casing',
      description: 'Capitalized after period',
      position: position
    });
    return `. ${letter.toUpperCase()}`;
  });

  // Step 5: Capitalize first letter
  if (result.length > 0 && /^[a-z]/.test(result)) {
    changes.push({
      type: 'casing',
      description: 'Capitalized first letter',
      position: 0
    });
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  // Step 6: Capitalize 'I' when standalone
  result = result.replace(/\bi\b/g, 'I');

  // Step 7: Add ending punctuation if missing
  if (result.length > 0 && !/[.!?]$/.test(result.trim())) {
    changes.push({
      type: 'punctuation',
      description: 'Added ending period',
      position: result.length
    });
    result = result.trim() + '.';
  }

  // Step 8: Fix common dictation artifacts
  result = fixCommonArtifacts(result, changes);

  return {
    original: text,
    corrected: result.trim(),
    changes
  };
}

function inferSentenceBoundaries(text: string, changes: Change[]): string {
  let result = text;

  // Look for transition words that likely indicate sentence boundaries
  BOUNDARY_TRIGGERS.forEach(trigger => {
    const pattern = new RegExp(`(\\s)(${trigger})\\s`, 'gi');
    result = result.replace(pattern, (match, space, word, offset) => {
      // Check if there's no punctuation before the trigger
      const beforeIndex = offset - 1;
      if (beforeIndex >= 0 && !/[.!?,;:]/.test(result[beforeIndex])) {
        changes.push({
          type: 'boundary',
          description: `Added period before "${word}"`,
          position: offset
        });
        return `. ${word.charAt(0).toUpperCase()}${word.slice(1)} `;
      }
      return match;
    });
  });

  // Look for patterns where sentence starters appear after lowercase text
  const starterPattern = new RegExp(
    `([a-z])\\s+(${SENTENCE_STARTERS.join('|')})\\s+([a-z])`,
    'gi'
  );
  
  // Only apply if sentence seems too long (heuristic: > 100 chars without punctuation)
  const segments = result.split(/[.!?]/);
  segments.forEach((segment, i) => {
    if (segment.length > 100) {
      // This segment is long, might need breaking
      changes.push({
        type: 'boundary',
        description: 'Long sentence detected - may need manual review',
        position: i
      });
    }
  });

  return result;
}

function fixCommonArtifacts(text: string, changes: Change[]): string {
  let result = text;

  // Fix "gonna" -> "going to"
  result = result.replace(/\bgonna\b/gi, 'going to');
  
  // Fix "wanna" -> "want to"
  result = result.replace(/\bwanna\b/gi, 'want to');
  
  // Fix "gotta" -> "got to"
  result = result.replace(/\bgotta\b/gi, 'got to');
  
  // Fix repeated words
  result = result.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // Fix spacing around punctuation
  result = result.replace(/\s+([,.])/g, '$1');
  result = result.replace(/([,.])\s{2,}/g, '$1 ');

  return result;
}

// Compute cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Split text into sentences for processing
export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);
}
