export const SHOT_TYPE_OPTIONS = [
  'Detalle macro',
  'Primer plano',
  'Plano medio',
  'Tres cuartos',
  'Cuerpo entero',
  'Cenital',
  'Picado',
  'Contrapicado',
];

export const VISUAL_STYLE_OPTIONS = [
  'Editorial',
  'Publicidad premium',
  'Cinematografico',
  'E-commerce',
  'Retrato de estudio',
  'Ilustracion',
  '3D render',
];

export const LIGHTING_OPTIONS = [
  'Suave',
  'Lateral',
  'Dramatica',
  'High key',
  'Low key',
  'Contraluz',
  'Estudio uniforme',
  'Luz natural',
];

export const MOOD_OPTIONS = [
  'Elegante',
  'Premium',
  'Minimalista',
  'Oscuro',
  'Luminoso',
  'Epico',
  'Moderno',
  'Emocional',
];

export type StructuredPromptFields = {
  subject: string;
  poseAction: string;
  shotType: string;
  visualStyle: string;
  lighting: string;
  mood: string;
  environment: string;
  requiredDetails: string;
  avoidElements: string;
};

export const EMPTY_STRUCTURED_PROMPT_FIELDS: StructuredPromptFields = {
  subject: '',
  poseAction: '',
  shotType: '',
  visualStyle: '',
  lighting: '',
  mood: '',
  environment: '',
  requiredDetails: '',
  avoidElements: '',
};

function buildDirectionLines(fields: StructuredPromptFields) {
  return [
    fields.subject.trim() ? `Sujeto principal: ${fields.subject.trim()}` : '',
    fields.poseAction.trim() ? `Accion o pose: ${fields.poseAction.trim()}` : '',
    fields.shotType.trim() ? `Plano o encuadre: ${fields.shotType.trim()}` : '',
    fields.visualStyle.trim() ? `Estilo visual: ${fields.visualStyle.trim()}` : '',
    fields.lighting.trim() ? `Iluminacion: ${fields.lighting.trim()}` : '',
    fields.mood.trim() ? `Mood o tono: ${fields.mood.trim()}` : '',
    fields.environment.trim() ? `Entorno o fondo: ${fields.environment.trim()}` : '',
    fields.requiredDetails.trim() ? `Detalles obligatorios: ${fields.requiredDetails.trim()}` : '',
    fields.avoidElements.trim() ? `Evitar: ${fields.avoidElements.trim()}` : '',
  ].filter(Boolean);
}

export function buildStructuredPrompt(fields: StructuredPromptFields) {
  return buildDirectionLines(fields).join('\n');
}

export function composeGeneralPrompt(
  manualGeneralPrompt: string,
  fields: StructuredPromptFields,
) {
  const segments = [buildStructuredPrompt(fields), manualGeneralPrompt.trim()].filter(Boolean);
  return segments.join('\n\n');
}

export function hasStructuredPromptContent(fields: StructuredPromptFields) {
  return buildDirectionLines(fields).length > 0;
}