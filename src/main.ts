import './styles/main.css';
import { App } from './app/App';

// Composition root: the only place that constructs concrete classes.
const app = new App();
app.start();
