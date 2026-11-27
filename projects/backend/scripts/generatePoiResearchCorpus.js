import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { locations } from '../seeders/seedLocations.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(backendRoot, 'corpus', 'manifests', 'S-033.json');

const CATEGORY_LABELS = {
  architecture: 'arquitectura civil',
  monument: 'monumento',
  nature: 'espacio natural',
  religious: 'monumento religioso',
  urban: 'espacio urbano',
  museum: 'museo',
  viewpoint: 'mirador',
  commerce: 'comercio',
  service: 'servicio',
};

const CIRCUIT_LABELS = {
  'casco-historico': 'casco histórico',
  museos: 'museos',
  'naturaleza-miradores': 'naturaleza y miradores',
  'espacios-urbanos': 'espacios urbanos',
  'la-vela': 'La Vela',
  'comercio-servicios': 'comercio y servicios',
};

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function sourceLine(location) {
  const hosts = [...new Set((location.contentSources ?? []).map(hostname))];
  return hosts.length
    ? `Fuentes citadas en la ficha: ${hosts.join(', ')}.`
    : 'La ficha no tiene fuentes externas adicionales.';
}

function questionsFor(location, aspect) {
  const title = location.title;

  if (aspect === 'que-es') {
    return [
      `¿Qué es ${title}?`,
      `¿Dónde está ${title}?`,
      `Cuéntame sobre ${title}`,
      `¿Qué hace especial a ${title}?`,
    ];
  }

  if (aspect === 'historia') {
    return [
      `¿Cuál es la historia de ${title}?`,
      `¿Cuándo se construyó ${title}?`,
      `¿Qué importancia histórica tiene ${title}?`,
      `¿Qué pasó con ${title}?`,
    ];
  }

  if (aspect === 'detalles') {
    return [
      `¿Qué puedo ver en ${title}?`,
      `¿Qué datos curiosos tiene ${title}?`,
      `¿Qué características tiene ${title}?`,
      `¿Qué lo hace importante? ${title}`,
    ];
  }

  return [
    `¿Cómo visito ${title}?`,
    `¿Qué recomendaciones hay para visitar ${title}?`,
    `¿Cuál es el horario de ${title}?`,
    `¿Cuánto cuesta entrar a ${title}?`,
  ];
}

function chunkFor(location, aspect, ordinal) {
  const category = CATEGORY_LABELS[location.category] ?? location.category;
  const circuits = (location.circuits ?? [])
    .map((circuit) => CIRCUIT_LABELS[circuit] ?? circuit)
    .join(', ');
  const address = location.address ? `Dirección registrada: ${location.address}.` : '';
  const currentStatus = ['museo-de-arte-de-coro', 'catedral-de-coro'].includes(
    location.slug,
  ) && aspect === 'visita';

  const text = {
    'que-es': `${location.title} es un lugar de ${category} en el circuito ${circuits}. ${address} ${location.whatIs ?? location.description}`,
    historia: `${location.title}. ${location.historicalStory ?? location.description}`,
    detalles: `${location.title}. ${(location.interestingFacts ?? []).join(' ')}`,
    visita: `${location.title}. ${location.visitorInfo ?? ''} ${sourceLine(location)}`,
  }[aspect]
    .replace(/\s+/g, ' ')
    .trim();

  return {
    chunkKey: `S-033#poi.${location.slug}.${aspect}`,
    ordinal,
    section: `${location.title} — ${aspect}`,
    claimType: currentStatus ? 'current_status' : aspect === 'historia' ? 'historical' : 'context',
    ...(currentStatus
      ? { validAsOf: '2026-11-24T00:00:00.000Z' }
      : {}),
    text,
    assistantScopes: ['tourist'],
    topics: ['patrimonio', 'turismo', 'investigación 2026', category, circuits],
    poiSlugs: [location.slug],
    questions: questionsFor(location, aspect),
  };
}

const published = locations
  .filter((location) => location.status === 'published')
  .sort((left, right) => left.slug.localeCompare(right.slug));

const source = {
  sourceId: 'S-033',
  title: 'Investigación patrimonial de los 23 lugares de Coro y La Vela (2026-11-26)',
  institution: 'Proyecto FALCONSYNC',
  version:
    'Investigación documental consolidada el 2026-11-26; fuentes citadas en cada ficha.',
  retrievedAt: '2026-11-26T00:00:00.000Z',
  verifiedAt: '2026-11-26T00:00:00.000Z',
  level: 'C',
  sourceLabel: 'Documentación del proyecto',
  usagePolicy: 'context',
  indexingPolicy: 'full_text',
  credibilityNotes:
    'Compilación editorial interna de FALCONSYNC basada en fuentes citadas en cada ficha. Distingue hechos documentados, tradiciones y datos operativos por confirmar; no sustituye la verificación directa de horarios, tarifas, accesibilidad ni estado de apertura. Conserva las discrepancias de fechas cuando las fuentes no coinciden.',
  license:
    'Contenido interno de FALCONSYNC. Cada fuente externa conserva sus derechos y se cita en la ficha del lugar.',
  rights:
    'Uso como contexto interno del proyecto con atribución a FALCONSYNC y a las fuentes citadas. No presentar como fuente independiente.',
  rightsVerified: true,
  rightsVerifiedAt: '2026-11-26T00:00:00.000Z',
  rightsVerifiedBy: '6aee4b03d9a54453e896062c',
  accessLevel: 'public',
  language: 'es',
  topics: ['POI', 'patrimonio', 'historia', 'turismo', 'investigación'],
  poiSlugs: published.map((location) => location.slug),
  status: 'active',
};

const chunks = published.flatMap((location, index) =>
  ['que-es', 'historia', 'detalles', 'visita'].map((aspect, aspectIndex) =>
    chunkFor(location, aspect, index * 4 + aspectIndex),
  ),
);

const manifest = {
  schemaVersion: 1,
  supersedesSourceId: 'S-021',
  source,
  chunks,
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `[rag:generate-poi] ${published.length} lugares, ${chunks.length} fragmentos -> ${outputPath}`,
);
