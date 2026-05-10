const STYLE_ID = 'step-header-styles';

const STYLES = `
.step-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #eee;
  font-family: system-ui, -apple-system, sans-serif;
  z-index: 10;
  pointer-events: none;
}
.step-header__dots {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.step-header__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid #888;
  background: transparent;
  box-sizing: border-box;
}
.step-header__dot--filled { background: #2c8; border-color: #2c8; }
.step-header__connector { width: 14px; height: 1.5px; background: #888; }
.step-header__connector--filled { background: #2c8; }
.step-header__title { font-size: 14px; font-weight: 500; }
`;

const STEP_TITLES: Record<1 | 2, string> = {
  1: 'Étape 1/2 · Photo de la facture',
  2: 'Étape 2/2 · Photo du QR-code',
};

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export interface StepHeaderOptions {
  step: 1 | 2;
}

export function mountStepHeader(rootEl: HTMLElement, opts: StepHeaderOptions): void {
  ensureStyles();

  const header = document.createElement('div');
  header.className = 'step-header';

  const dots = document.createElement('div');
  dots.className = 'step-header__dots';

  const dot1 = document.createElement('div');
  dot1.className = 'step-header__dot step-header__dot--filled';
  dots.appendChild(dot1);

  const connector = document.createElement('div');
  connector.className =
    opts.step >= 2
      ? 'step-header__connector step-header__connector--filled'
      : 'step-header__connector';
  dots.appendChild(connector);

  const dot2 = document.createElement('div');
  dot2.className =
    opts.step >= 2
      ? 'step-header__dot step-header__dot--filled'
      : 'step-header__dot';
  dots.appendChild(dot2);

  header.appendChild(dots);

  const title = document.createElement('div');
  title.className = 'step-header__title';
  title.textContent = STEP_TITLES[opts.step];
  header.appendChild(title);

  rootEl.appendChild(header);
}
