// Liste des études "prêtes à importer" dans /admin/etudes. Pour en ajouter une : créer son fichier
// dans ce dossier et l'ajouter ci-dessous.
import { MIROFISH_1 } from './mirofish-1';
import { MIROFISH_2 } from './mirofish-2';

export type StudyImport = {
  slug: string;
  title: string;
  question: string;
  summary: string;
  findings: string | string[];
  report?: string;
  tasks: { title: string; description: string; status: 'TODO' | 'IN_PROGRESS' | 'DONE'; notes: string }[];
};

export const STUDY_IMPORTS: StudyImport[] = [MIROFISH_1, MIROFISH_2];
