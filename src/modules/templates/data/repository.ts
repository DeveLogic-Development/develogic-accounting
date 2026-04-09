import { TemplatesState } from '../domain/types';

export interface TemplatesRepository {
  load(): TemplatesState | null;
  save(state: TemplatesState): void;
}
