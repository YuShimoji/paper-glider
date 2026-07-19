import './styles.css';
import { PaperGliderGame } from './game/PaperGliderGame';
import { preloadWorkbenchRoomAsset } from './game/assets/WorkbenchRoomAssetLoader';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Paper Glider could not find its application root.');
}
const root = app;

async function boot(): Promise<void> {
  const assetResult = await preloadWorkbenchRoomAsset({ baseUrl: import.meta.env.BASE_URL });
  new PaperGliderGame(root, assetResult);
}

void boot();
