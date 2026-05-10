Compris, je simplifie encore. Voici la version finale épurée :

# Cahier des charges — Application web de scan QR-bill

## 1. Contexte et objectifs

### 1.1 Contexte
Application web permettant à un utilisateur de scanner une facture suisse au format **QR-bill** (Swiss QR Code, norme SIX/Swico v2.3) en deux étapes via la caméra :

1. Capture photographique de la page complète de la facture
2. Capture, décodage et validation du QR-bill

### 1.2 Cible
- Usage exclusivement via navigateur web (desktop + mobile)
- Pas d'application native, pas de PWA installable, pas de backend
- Tout fonctionne côté client

### 1.3 Outputs attendus
1. **Photo de la page complète** (image)
2. **Photo du QR-bill** (image)
3. **Données décodées et validées** (objet structuré : créancier, IBAN, montant, devise, référence, débiteur, message, etc.)

### 1.4 Principe directeur
**Si le QR ne se décode pas, le scan échoue.** L'utilisateur réessaie. Pas d'OCR, pas de saisie manuelle.

### 1.5 Contraintes techniques
- Bundle JavaScript total : **< 250 KB**
- HTTPS obligatoire (`getUserMedia` l'exige)
- Compatible navigateurs modernes desktop et mobile (iOS Safari inclus)
- Conformité stricte à la norme **Swiss Payment Standards — Implementation Guidelines QR-bill v2.3**

---

## 2. Périmètre fonctionnel

### 2.1 Étape 1 — Capture de la page complète

**Description** : L'utilisateur place sa facture devant la caméra. L'application capture automatiquement la photo dès que les conditions de stabilité et de netteté sont réunies.

**Fonctionnalités** :
- Affichage du flux vidéo en temps réel
- Overlay graphique d'un guide rectangulaire (proportions A4) pour le cadrage
- Détection automatique de la stabilité de l'image
- Détection automatique de la netteté
- Capture automatique dès que stabilité + netteté sont validées pendant ~500 ms
- Feedback visuel progressif (cadre rouge → orange → vert)
- Bouton de capture manuelle en fallback
- Confirmation visuelle (flash), sonore et tactile (vibration mobile)
- Possibilité de reprendre la photo

**Critères d'acceptation** :
- Capture déclenchée en moins de 2 secondes en conditions normales
- Aucune capture si l'image est floue
- Résolution minimum 1280×1800 pour archivage lisible

### 2.2 Étape 2 — Capture, décodage et validation du QR-bill

**Description** : L'utilisateur cadre le QR code dans le guide. L'application décode et valide dès que le QR est lisible.

**Sous-étapes** :

1. **Décodage brut** : `jsQR` extrait la chaîne UTF-8
2. **Parsing structuré** : split par CRLF, mapping vers les 31 champs nommés
3. **Validation syntaxique** :
   - Préfixe `SPC`
   - Version supportée (`0200`)
   - Coding type `1` (UTF-8)
   - Nombre de lignes conforme
   - Marqueur `EPD` présent
4. **Validations métier** (cf. section 3.4)
5. **Affichage structuré** : créancier, débiteur, montant, devise, référence, message, infos facture
6. **Indicateur de validité** :
   - ✅ Valide
   - ⚠️ Valide avec avertissements
   - ❌ Invalide (avec liste des erreurs)

**Fonctionnalités** :
- Flux vidéo en temps réel
- Overlay graphique d'un guide carré pour le QR
- Tentative de décodage en continu (1 frame sur 2)
- Capture automatique dès qu'un QR est décodé
- Affichage du résultat structuré

**En cas d'échec** :
- Si rien n'est détecté après 30 s : message clair "Aucun QR-bill détecté, réessayez"
- L'utilisateur peut relancer autant de fois que nécessaire

**Critères d'acceptation** :
- Décodage en moins de 1 seconde dès que le QR est correctement cadré
- Tolérance aux inclinaisons jusqu'à 30°
- 100% de réussite sur le jeu officiel de QR-bills de test SIX

### 2.3 Parcours utilisateur

```
[Accueil + autorisation caméra]
       ↓
[Étape 1 : capture page]
       ↓
[Étape 2 : capture + décodage QR-bill]
       ↓
[Résultat : 2 images + données décodées]
       OU
[Échec : "Réessayer"]
```

### 2.4 Format de sortie

À la fin du parcours réussi, l'application restitue :

```
{
  "pageImage": Blob (JPEG, ~1280×1800),
  "qrImage": Blob (JPEG, ~800×800),
  "qrBillData": {
    "valid": true,
    "warnings": [],
    "errors": [],
    "creditor": {
      "iban": "CH9300762011623852957",
      "name": "Robert Schneider SA",
      "address": "Rue du Lac 1268",
      "buildingNumber": "2/22",
      "postalCode": "2501",
      "city": "Biel",
      "country": "CH"
    },
    "amount": 3949.75,
    "currency": "CHF",
    "reference": {
      "type": "QRR",
      "value": "210000000003139471430009017"
    },
    "debtor": {
      "name": "Pia-Maria Rutschmann-Schnyder",
      "address": "Grosse Marktgasse 28",
      "postalCode": "9400",
      "city": "Rorschach",
      "country": "CH"
    },
    "unstructuredMessage": "Instructions de paiement",
    "billInformation": "//S1/10/10201409/..."
  }
}
```

L'usage de cet output (envoi serveur, affichage, copie, export) est **hors périmètre** : l'application se contente de produire le résultat.

---

## 3. Spécifications techniques

### 3.1 Stack technique

| Composant | Choix | Taille | Justification |
|-----------|-------|--------|---------------|
| Capture vidéo | `getUserMedia` | 0 KB | Standard W3C |
| Décodage QR | `jsQR` | ~40 KB | JS pur, pas de WASM |
| Parsing + validation QR-bill | `swissqrbill` (validation) | ~80–120 KB | Conformité norme garantie |
| Détection stabilité/netteté | Code maison | ~2 KB | Algos simples (diff pixels + Laplacien) |
| UI | HTML/CSS/JS vanilla | Variable | Léger, pas de framework lourd |

### 3.2 Architecture

```
┌─────────────────────────────────────────┐
│         Application Web Shell           │
├─────────────────────────────────────────┤
│  CameraManager (getUserMedia)           │
│  ├─ StabilityDetector                   │
│  ├─ SharpnessDetector                   │
│  └─ CaptureController                   │
├─────────────────────────────────────────┤
│  QRBillProcessor                        │
│  ├─ jsQR (décodage)                     │
│  ├─ Parser (CRLF → 31 champs)           │
│  └─ Validators                          │
│     ├─ IBAN (mod-97)                    │
│     ├─ Référence (mod-10 / mod-97)      │
│     ├─ Cohérence IBAN/référence         │
│     ├─ Montant, devise                  │
│     └─ Adresses                         │
├─────────────────────────────────────────┤
│  UI Layer                               │
│  ├─ VideoPreview                        │
│  ├─ GuideOverlay                        │
│  ├─ FeedbackIndicator                   │
│  └─ ResultDisplay                       │
└─────────────────────────────────────────┘
```

### 3.3 Structure du QR-bill (norme SIX v2.3)

Payload UTF-8, séparateur CRLF (`\r\n`), 28 à 31+ champs ordonnés :

| # | Champ | Description | Obligatoire |
|---|-------|-------------|-------------|
| 1 | QRType | Toujours `SPC` | ✓ |
| 2 | Version | `0200` | ✓ |
| 3 | Coding type | `1` (UTF-8) | ✓ |
| 4 | IBAN | Compte créancier (CH/LI) | ✓ |
| 5 | Adresse type créancier | `S` ou `K` | ✓ |
| 6–11 | Adresse créancier | Nom, rue, n°, NPA, ville, pays | ✓ |
| 12–18 | Créancier final | (en général vide) | – |
| 19 | Montant | Numérique, max 2 décimales | – |
| 20 | Devise | `CHF` ou `EUR` | ✓ |
| 21 | Adresse type débiteur | `S` ou `K` (vide possible) | – |
| 22–27 | Adresse débiteur | Nom, rue, n°, NPA, ville, pays | – |
| 28 | Type référence | `QRR`, `SCOR` ou `NON` | ✓ |
| 29 | Référence | Selon type | – |
| 30 | Message non structuré | Texte libre | – |
| 31 | EPD | Marqueur de fin | ✓ |
| 32+ | Informations facture | Section Swico (optionnelle) | – |

### 3.4 Règles de validation

**IBAN (champ 4)** :
- mod-97 (ISO 13616)
- Pays : `CH` ou `LI` uniquement
- Longueur : 21 caractères
- Si IID positions 5-9 entre 30000-31999 → QR-IBAN, exige référence QRR

**Type de référence (champs 28-29)** :
- `QRR` : 27 chiffres + check digit mod-10 récursif
- `SCOR` : ISO 11649 (RF + check digit mod-97)
- `NON` : référence vide obligatoire

**Cohérence IBAN ↔ référence** :
- QR-IBAN ⇒ `QRR` obligatoire
- IBAN normal ⇒ `SCOR` ou `NON`

**Montant** : numérique, max 2 décimales, ≤ 999 999 999.99, peut être vide

**Devise** : `CHF` ou `EUR`

**Adresses** : structurée (`S`) ou combinée (`K`), pays ISO 3166 alpha-2 valide

### 3.5 Algorithmes de détection

**Stabilité** : downscale frame → 32×32 grayscale, diff absolue moyenne avec frame précédente. Stable si diff < seuil pendant N frames.

**Netteté** : downscale frame → 200×200 grayscale, convolution Laplacien 3×3, variance du résultat. Net si variance > seuil.

**Mod-10 récursif (QRR)** : table de transition ESR/BVR, itération sur 26 chiffres, comparaison du 27ᵉ.

**Mod-97 (IBAN/SCOR)** : déplacement des 4 premiers caractères, conversion lettres (A=10..Z=35), résultat mod 97 = 1.

### 3.6 Performance

- Analyse des frames à 15 FPS max (downscaling)
- Rendu vidéo en pleine résolution
- Décodage QR sur 1 frame sur 2
- Validation post-décodage : < 50 ms

---

## 4. Spécifications UI/UX

### 4.1 Design général
- Plein écran sur mobile, fenêtre centrée sur desktop
- Vidéo en arrière-plan, overlays SVG/Canvas par-dessus
- Boutons larges (min 44×44 px)
- Fond sombre pour ne pas perturber la perception caméra

### 4.2 États visuels du guide

| État | Couleur cadre | Message |
|------|---------------|---------|
| Inactif | Gris | "Cadrez la facture" |
| Détection en cours | Rouge | "Ajustez le cadrage" |
| Stabilisation | Orange | "Stabilisez..." |
| Capture imminente | Vert (qui se remplit) | "Tenez bon..." |
| Capturé | Vert + flash | "✓ Photo prise" |

### 4.3 Affichage du résultat

**Si valide** :
```
✅ QR-bill valide
─────────────────────────
Créancier  : Robert Schneider SA
             Rue du Lac 1268, 2501 Biel, CH
IBAN       : CH93 0076 2011 6238 5295 7
Montant    : CHF 3 949.75
Référence  : 21 00000 00003 13947 14300 09017 (QRR)
Débiteur   : Pia-Maria Rutschmann-Schnyder
Message    : Instructions de paiement
─────────────────────────
[Recommencer]
```

**Si invalide** :
```
❌ QR-bill invalide
─────────────────────────
Erreurs détectées :
  • IBAN invalide (checksum incorrect)
  • Référence QRR : check digit erroné
─────────────────────────
[Recommencer]
```

### 4.4 Feedback sonore et tactile
- Son court de capture (désactivable)
- Vibration 100 ms sur mobile lors de la capture
- Flash blanc visuel court (200 ms)

### 4.5 Responsive
- Mobile portrait/paysage : guide adapté à l'orientation
- Desktop : ratio caméra respecté
- Adaptation automatique aux dimensions du flux vidéo

---

## 5. Compatibilité

| Navigateur | Version min | Notes |
|------------|-------------|-------|
| Chrome (desktop/Android) | 90+ | Support complet |
| Firefox | 88+ | Support complet |
| Safari (macOS) | 14+ | Support complet |
| Safari (iOS) | 14+ | `playsinline`, `muted`, `autoplay` requis |
| Edge | 90+ | Support complet |

**Permissions caméra** :
- Demande explicite au premier lancement
- Préférence caméra arrière sur mobile (`facingMode: 'environment'`)
- Si refusée : message d'aide pour débloquer dans les paramètres navigateur

**Résolutions** : `ideal: 1920×1080`, accepte tout flux ≥ 640×480

---

## 6. Tests et qualité

### 6.1 Tests fonctionnels
- Scan réussi en conditions normales
- Rejet de la capture en cas de flou ou mouvement
- Décodage des QR-bills officiels de test SIX
- Validation des QR-IBAN et IBAN normaux
- Validation des trois types de référence (QRR, SCOR, NON)
- Détection des erreurs : IBAN invalide, référence corrompue, incohérences
- Gestion des QR-bills sans montant
- Gestion des QR-bills CHF et EUR

### 6.2 Tests de compatibilité
- iPhone (iOS 14+, Safari)
- Android (Chrome, Samsung Internet)
- Desktop (Chrome, Firefox, Safari, Edge)
- Webcam intégrée et webcam USB

### 6.3 Tests de performance
- Chargement initial < 2 s sur 4G
- Flux vidéo fluide (30 FPS minimum)
- UI réactive en permanence

### 6.4 Tests de conformité
- 100% de réussite sur le jeu officiel SIX

---

## 7. Livrables

- Code source commenté
- Bundle minifié prêt pour production
- Tests automatisés (parsing + validation)
- Documentation : intégration, API publique, format de l'output
- Page de démonstration fonctionnelle

---

## 8. Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Permissions caméra refusées | Bloquant | Message clair pour débloquer |
| Performances faibles sur mobile bas de gamme | Moyen | Downscaling agressif |
| QR mal éclairé | Moyen | Activation flash si supporté (`MediaTrackConstraints.torch`) |
| Faux positif de validation | **Critique** | Lib éprouvée + jeu de tests officiels |
| Compatibilité iOS Safari | Moyen | Tests dédiés, attributs HTML spécifiques |

---

## 9. Estimation indicative

| Phase | Charge |
|-------|--------|
| Setup projet + accès caméra | 0,5 j |
| Détection stabilité + netteté | 1 j |
| Intégration jsQR + capture auto | 0,5 j |
| Intégration parsing/validation QR-bill | 1 j |
| Tests sur jeu officiel SIX | 1 j |
| UI/UX, overlays, affichage résultats | 2 j |
| Gestion d'états et parcours | 1 j |
| Responsive multi-plateforme | 1 j |
| Tests fonctionnels et corrections | 1,5 j |
| Documentation | 0,5 j |
| **Total** | **~10 jours** |

*Pour un développeur expérimenté.*

---

## 10. Références

- **Swiss Payment Standards — Implementation Guidelines QR-bill v2.3** (SIX Group)
- **Style Guide QR-bill** (SIX Group)
- **ISO 13616** (IBAN), **ISO 11649** (référence créancier), **ISO 3166-1 alpha-2** (codes pays)
- <https://www.paymentstandards.ch/>

---

Hors périmètre v1 (mais possibles évolutions) : OCR, saisie manuelle, redressement de perspective, génération de paiement (deep links bancaires), historique, mode hors-ligne, multi-pages.
