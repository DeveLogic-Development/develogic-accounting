import { createPresetTemplateState } from '../domain/defaults';
import { TemplatesState } from '../domain/types';

export function createTemplatesSeedState(): TemplatesState {
  return createPresetTemplateState(new Date().toISOString());
}
