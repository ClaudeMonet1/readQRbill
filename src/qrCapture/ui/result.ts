import type { QRBillData } from '../types';

const RESULT_STYLE_ID = 'qr-result-styles';

const STYLES = `
.qr-result { position: fixed; inset: 0; background: #000; color: #eee; padding: 24px; box-sizing: border-box; overflow: auto; font-family: system-ui, -apple-system, sans-serif; }
.qr-result__inner { max-width: 600px; margin: 0 auto; }
.qr-result__header { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
.qr-result__header--ok { color: #2c8; }
.qr-result__header--err { color: #f55; }
.qr-result__rule { border: 0; border-top: 1px solid #444; margin: 12px 0; }
.qr-result__row { display: grid; grid-template-columns: 110px 1fr; gap: 8px; margin: 6px 0; font-size: 15px; }
.qr-result__label { color: #999; }
.qr-result__value { color: #eee; word-break: break-word; white-space: pre-line; }
.qr-result__issues { list-style: none; padding: 0; margin: 8px 0; }
.qr-result__issues li { padding: 6px 0; color: #f99; }
.qr-result__buttons { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; justify-content: center; }
.qr-result__btn { padding: 14px 32px; min-width: 160px; min-height: 48px; font-size: 16px; border: 1px solid #888; border-radius: 24px; background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; }
.qr-result__btn--primary { background: #2c8; border-color: #2c8; color: #000; font-weight: 600; }
.qr-result__photos { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.qr-result__photo { flex: 1 1 0; min-width: 140px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.qr-result__photo img { max-width: 100%; max-height: 220px; object-fit: contain; border-radius: 6px; background: #111; }
.qr-result__photo__label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
`;

function ensureStyles(): void {
  if (document.getElementById(RESULT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = RESULT_STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

function formatQrr(ref: string): string {
  if (ref.length !== 27) return ref;
  return `${ref.slice(0, 2)} ${ref.slice(2, 7)} ${ref.slice(7, 12)} ${ref.slice(12, 17)} ${ref.slice(17, 22)} ${ref.slice(22, 27)}`;
}

function formatScor(ref: string): string {
  return ref.replace(/(.{4})/g, '$1 ').trim();
}

function formatReference(type: string, value: string): string {
  if (type === 'QRR') return formatQrr(value);
  if (type === 'SCOR') return formatScor(value);
  return value;
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return `${currency} —`;
  return `${currency} ${new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function row(label: string, value: string): HTMLDivElement {
  const r = document.createElement('div');
  r.className = 'qr-result__row';
  const l = document.createElement('div');
  l.className = 'qr-result__label';
  l.textContent = label;
  const v = document.createElement('div');
  v.className = 'qr-result__value';
  v.textContent = value;
  r.appendChild(l);
  r.appendChild(v);
  return r;
}

function partyAddress(p: { address: string; buildingNumber: string; postalCode: string; city: string; country: string }): string {
  const line1 = [p.address, p.buildingNumber].filter(Boolean).join(' ');
  const line2 = [p.postalCode, p.city].filter(Boolean).join(' ');
  return [line1, [line2, p.country].filter(Boolean).join(', ')].filter(Boolean).join('\n');
}

export interface ResultActions {
  onRetry: () => void;
  onAccept: () => void;
}

export interface ResultImages {
  pageImage: Blob;
  qrImage: Blob;
}

function photoBlock(label: string, blob: Blob, alt: string): HTMLDivElement {
  const block = document.createElement('div');
  block.className = 'qr-result__photo';

  const lab = document.createElement('div');
  lab.className = 'qr-result__photo__label';
  lab.textContent = label;
  block.appendChild(lab);

  const img = document.createElement('img');
  img.alt = alt;
  img.src = URL.createObjectURL(blob);
  img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
  block.appendChild(img);

  return block;
}

export function showResult(
  rootEl: HTMLElement,
  data: QRBillData,
  images: ResultImages,
  actions: ResultActions,
): void {
  ensureStyles();
  rootEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'qr-result';
  const inner = document.createElement('div');
  inner.className = 'qr-result__inner';
  wrap.appendChild(inner);

  const header = document.createElement('div');
  header.className = `qr-result__header qr-result__header--${data.valid ? 'ok' : 'err'}`;
  header.textContent = data.valid ? '✅ QR-bill valide' : '❌ QR-bill invalide';
  inner.appendChild(header);

  const photos = document.createElement('div');
  photos.className = 'qr-result__photos';
  photos.appendChild(photoBlock('Facture', images.pageImage, 'Photo de la page'));
  photos.appendChild(photoBlock('QR-bill', images.qrImage, 'Photo du QR-bill'));
  inner.appendChild(photos);

  const hr = document.createElement('hr');
  hr.className = 'qr-result__rule';
  inner.appendChild(hr);

  if (data.valid) {
    inner.appendChild(row('Créancier', data.creditor.name + '\n' + partyAddress(data.creditor)));
    inner.appendChild(row('IBAN', formatIban(data.creditor.iban)));
    inner.appendChild(row('Montant', formatAmount(data.amount, data.currency)));
    inner.appendChild(row('Référence', `${formatReference(data.reference.type, data.reference.value)} (${data.reference.type})`));
    if (data.debtor) {
      inner.appendChild(row('Débiteur', data.debtor.name + '\n' + partyAddress(data.debtor)));
    }
    if (data.unstructuredMessage) {
      inner.appendChild(row('Message', data.unstructuredMessage));
    }
    if (data.warnings.length > 0) {
      const warnHeader = document.createElement('div');
      warnHeader.className = 'qr-result__label';
      warnHeader.textContent = 'Avertissements :';
      inner.appendChild(warnHeader);
      const ul = document.createElement('ul');
      ul.className = 'qr-result__issues';
      for (const w of data.warnings) {
        const li = document.createElement('li');
        li.textContent = `• ${w.message}`;
        ul.appendChild(li);
      }
      inner.appendChild(ul);
    }
  } else {
    const errHeader = document.createElement('div');
    errHeader.className = 'qr-result__label';
    errHeader.textContent = 'Erreurs détectées :';
    inner.appendChild(errHeader);
    const ul = document.createElement('ul');
    ul.className = 'qr-result__issues';
    for (const e of data.errors) {
      const li = document.createElement('li');
      li.textContent = `• ${e.message}`;
      ul.appendChild(li);
    }
    inner.appendChild(ul);
  }

  const hr2 = document.createElement('hr');
  hr2.className = 'qr-result__rule';
  inner.appendChild(hr2);

  const btnRow = document.createElement('div');
  btnRow.className = 'qr-result__buttons';

  const retryBtn = document.createElement('button');
  retryBtn.className = 'qr-result__btn';
  retryBtn.type = 'button';
  retryBtn.textContent = 'Recommencer';
  retryBtn.addEventListener('click', actions.onRetry);
  btnRow.appendChild(retryBtn);

  if (data.valid) {
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'qr-result__btn qr-result__btn--primary';
    acceptBtn.type = 'button';
    acceptBtn.textContent = 'Continuer →';
    acceptBtn.addEventListener('click', actions.onAccept);
    btnRow.appendChild(acceptBtn);
  }

  inner.appendChild(btnRow);
  rootEl.appendChild(wrap);
}
