import type { State } from '../stateMachine';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface OverlayHandle {
  element: SVGSVGElement;
  setVariant: (state: State['kind']) => void;
}

export function createOverlay(): OverlayHandle {
  // viewBox uses A4 ratio: 100 wide, 141.4 tall, then we wrap it to fit.
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'pc-overlay pc-overlay--idle');
  svg.setAttribute('viewBox', '0 0 100 141.4');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '2');
  rect.setAttribute('y', '2');
  rect.setAttribute('width', '96');
  rect.setAttribute('height', '137.4');
  rect.setAttribute('rx', '2');
  rect.setAttribute('class', 'pc-overlay__rect');
  svg.appendChild(rect);

  const setVariant = (kind: State['kind']) => {
    svg.setAttribute('class', `pc-overlay pc-overlay--${kind}`);
  };

  return { element: svg, setVariant };
}
