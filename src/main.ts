import './styles.css';
import { PaperGliderGame } from './game/PaperGliderGame';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Paper Glider could not find its application root.');
}

new PaperGliderGame(app);
