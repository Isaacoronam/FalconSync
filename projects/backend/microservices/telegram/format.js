export const CATEGORY_LABELS = Object.freeze({
  structural: 'Estructural',
  moisture: 'Humedad',
  cracks: 'Grietas',
  material_loss: 'Pérdida de material',
  vandalism: 'Vandalismo',
  vegetation: 'Vegetación',
  fire: 'Incendio',
  collapse_risk: 'Riesgo de colapso',
  other: 'Otro',
});

export const CATEGORY_OPTIONS = Object.freeze(
  Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
);

export const STATE_LABELS = Object.freeze({
  received: 'Recibido',
  triaged: 'En revisión',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  converted: 'Convertido en inspección',
  closed: 'Cerrado',
});

const DIFFICULTY_LABELS = Object.freeze({
  easy: 'Fácil',
  moderate: 'Moderada',
  challenging: 'Exigente',
});

export function categoryLabel(value) {
  return CATEGORY_LABELS[value] ?? value;
}

export function stateLabel(value) {
  return STATE_LABELS[value] ?? value;
}

export function difficultyLabel(value) {
  return DIFFICULTY_LABELS[value] ?? value;
}

export function formatDate(value) {
  if (!value) {
    return 'sin fecha';
  }

  return new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function splitText(text, maxLength = 3900) {
  const normalized = String(text ?? '').trim();
  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const chunks = [];
  let remaining = normalized;

  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf('\n\n', maxLength);
    if (cut < maxLength * 0.5) {
      cut = remaining.lastIndexOf('\n', maxLength);
    }
    if (cut < maxLength * 0.5) {
      cut = remaining.lastIndexOf(' ', maxLength);
    }
    if (cut < maxLength * 0.5) {
      cut = maxLength;
    }

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

export function formatGuideAnswer(answer) {
  const parts = [answer.answer];

  if (answer.citations?.length) {
    const sources = answer.citations.slice(0, 2).map((citation) => {
      const link = citation.url ? ` — ${citation.url}` : '';
      const institution = citation.institution ? ` (${citation.institution})` : '';
      return `• ${citation.title}${institution}${link}`;
    });

    parts.push(`Fuentes:\n${sources.join('\n')}`);
  }

  if (answer.suggestions?.length) {
    parts.push(`Puedes preguntar:\n${answer.suggestions.map((item) => `• ${item}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

export function formatPoiOption(poi) {
  const address = poi.address ? ` — ${poi.address}` : '';
  const distance = poi.distanceMeters ? ` (a ${poi.distanceMeters} m)` : '';
  return `${poi.title}${address}${distance}`;
}

export function formatRouteList(routes) {
  if (!routes.length) {
    return 'No hay recorridos publicados en este momento.';
  }

  return [
    'Recorridos peatonales publicados:',
    ...routes.map(
      (route) =>
        `• ${route.title} — ${route.stopsCount} paradas, ${route.estimatedMinutes} min, dificultad ${difficultyLabel(route.difficulty)}`,
    ),
    'Elige uno para ver sus paradas.',
  ].join('\n');
}

export function formatRoute(route) {
  const lines = [
    route.title,
    route.summary,
    `Dificultad: ${difficultyLabel(route.difficulty)} · Duración estimada: ${route.estimatedMinutes} min`,
    '',
    route.disclaimer,
    '',
    'Paradas:',
  ];

  for (const stop of route.stops) {
    const address = stop.address ? ` — ${stop.address}` : '';
    lines.push(`${stop.order}. ${stop.title}${address}`);
    if (stop.mapUrl) {
      lines.push(`   Mapa: ${stop.mapUrl}`);
    }
    if (stop.instructions) {
      lines.push(`   ${stop.instructions}`);
    }
  }

  return lines.join('\n');
}

export function formatReportConfirmation(data) {
  const hasLocation =
    data.locationLatitude !== undefined &&
    data.locationLatitude !== null &&
    data.locationLongitude !== undefined &&
    data.locationLongitude !== null;
  const location = hasLocation
    ? `Ubicación compartida (${data.locationLatitude.toFixed(5)}, ${data.locationLongitude.toFixed(5)})`
    : 'Sin ubicación adjunta';

  return [
    'Confirma la incidencia:',
    `Lugar: ${data.locationTitle}`,
    `Categoría: ${categoryLabel(data.category)}`,
    `Descripción: ${data.description}`,
    `Ubicación: ${location}`,
    '',
    'Al confirmar, el reporte entra en la cola de revisión de FalconSync.',
  ].join('\n');
}

export function formatReportCreated(result) {
  const report = result.report;
  return [
    'Incidencia registrada.',
    `ID: ${report.id}`,
    `Lugar: ${report.location?.title ?? 'sin lugar'}`,
    `Categoría: ${categoryLabel(report.category)}`,
    `Estado: ${stateLabel(report.state)}`,
    '',
    result.nextStep,
  ].join('\n');
}

export function formatReportList(result) {
  if (!result.reportes?.length) {
    return (result.meta?.page ?? 1) > 1
      ? 'No hay más incidencias en esa página.'
      : 'Todavía no has creado incidencias.';
  }

  const lines = ['Tus incidencias:'];

  for (const report of result.reportes) {
    lines.push(
      `• ${formatDate(report.createdAt)} — ${report.location?.title ?? 'sin lugar'} — ${categoryLabel(report.category)} — ${stateLabel(report.state)}`,
    );
  }

  const page = result.meta?.page ?? 1;
  if (result.meta?.hasMore) {
    lines.push(
      `Mostrando ${result.reportes.length} de ${result.meta.total} (página ${page}).`,
    );
  } else if ((result.meta?.total ?? 0) > result.reportes.length) {
    lines.push(`Mostrando ${result.reportes.length} de ${result.meta.total}.`);
  }

  return lines.join('\n');
}

export function formatReportDetail(result, webUrl) {
  const report = result.report;
  const lines = [
    'Incidencia',
    `Lugar: ${report.location?.title ?? 'sin lugar'}`,
    `Categoría: ${categoryLabel(report.category)}`,
    `Estado: ${stateLabel(report.state)}`,
    `Creada: ${formatDate(report.createdAt)}`,
    '',
    report.description,
  ];

  if (report.rejectionReason) {
    lines.push('', `Motivo de rechazo o cierre: ${report.rejectionReason}`);
  }

  const coordinates = report.gps?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    lines.push('', `GPS: ${coordinates[1]}, ${coordinates[0]}`);
  }

  lines.push('', `Detalle en FalconSync: ${webUrl}/reportes/${report.id}`);
  return lines.join('\n');
}

export function formatNearbyPois(pois, webUrl) {
  if (!pois?.length) {
    return 'No encontré lugares publicados a menos de 2 km.';
  }

  const lines = ['Lugares cerca de ti:'];

  for (const [index, poi] of pois.entries()) {
    const address = poi.address ? ` — ${poi.address}` : '';
    lines.push(`${index + 1}. ${poi.title}${address} (a ${poi.distanceMeters} m)`);
    lines.push(`   ${webUrl}/lugares/${poi.slug}`);
  }

  lines.push('', 'Abre un enlace para ver la ficha del lugar.');
  return lines.join('\n');
}
