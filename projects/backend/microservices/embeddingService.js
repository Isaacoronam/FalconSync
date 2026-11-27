import { config } from '../helpers/env.js';

let extractorPromise = null;
let embedderForTests = null;

export function modelIdentity() {
  return `${config.assistant.embeddingModel}@${config.assistant.embeddingDtype}`;
}

export function setEmbedderForTests(embedder) {
  embedderForTests = embedder;
  extractorPromise = null;
}

async function loadExtractor() {
  const { env, pipeline } = await import('@huggingface/transformers');
  env.cacheDir = config.assistant.embeddingCacheDir;
  env.allowRemoteModels = config.assistant.embeddingAllowRemote;

  return pipeline('feature-extraction', config.assistant.embeddingModel, {
    dtype: config.assistant.embeddingDtype,
  });
}

function getExtractor() {
  extractorPromise ??= loadExtractor().catch((error) => {
    extractorPromise = null;
    throw error;
  });

  return extractorPromise;
}

export async function embedTexts(texts) {
  if (texts.length === 0) {
    return [];
  }

  if (embedderForTests) {
    return embedderForTests(texts);
  }

  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });

  return output.tolist();
}

export function cosineSimilarity(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
}
