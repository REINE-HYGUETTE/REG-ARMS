"""
REG AI-Based Request Management System
AI Priority Prediction Flask API
Endpoint: POST /api/predict
Technologies: Python, Flask, Scikit-learn, NLP, TF-IDF, Logistic Regression, Random Forest, Naive Bayes
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
import pickle
import os
import re
import time
import logging
from collections import defaultdict
from datetime import datetime

# === Scikit-learn imports ===
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import cross_val_score
from sklearn.metrics import classification_report
from sklearn.preprocessing import LabelEncoder

# === NLP ===
import nltk
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
from nltk.tokenize import word_tokenize

# Download NLTK data on first run
nltk.download('punkt',      quiet=True)
nltk.download('stopwords',  quiet=True)
nltk.download('punkt_tab',  quiet=True)

# ============================================================
# APP SETUP
# ============================================================
app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

MODEL_PATH      = 'models/reg_priority_model.pkl'
VECTORIZER_PATH = 'models/reg_tfidf_vectorizer.pkl'
DATASET_PATH    = 'training_dataset.csv'
MODEL_VERSION   = '1.2.0'
MAX_BATCH_SIZE  = 50   # hard cap for POST /api/predict/batch

# ============================================================
# URGENCY KEYWORDS  (domain-specific for energy sector)
# ============================================================
URGENT_KEYWORDS = {
    # Only phrases/words that are UNAMBIGUOUSLY life-threatening in context.
    # Single common words (school, child, damage) are moved out to avoid
    # false-positive elevation on routine requests.
    'critical': [
        'emergency', 'explosion', 'fire', 'blast', 'burning',
        'hospital power', 'clinic power', 'life support', 'icu', 'oxygen machine',
        'electrocution', 'electrocuted', 'electric shock accident', 'unconscious',
        'fallen high voltage', 'fallen live wire', 'sparking wire', 'arc flash',
        'life-threatening', 'someone died', 'person died', 'death',
        'children hospital', 'school blackout', 'injured by electricity',
        # French / Kinyarwanda
        'urgence vitale', 'incendie électrique', 'électrocution', 'blessé grave',
        'kuba intimba', 'amashanyarazi yarashe',
    ],
    'high': [
        'days without power', 'weeks without power', 'no power for days',
        'many people affected', 'hundreds of customers', 'large area outage',
        'widespread outage', 'entire neighborhood', 'whole district',
        'health center outage', 'water pump failed', 'cold storage failing',
        'industrial failure', 'factory shutdown', 'production stopped',
        'dangerous voltage', 'hazardous', 'structural damage', 'transformer exploded',
        'burst', 'destroyed transformer',
        # French
        'panne générale', 'coupure générale', 'toute la zone',
    ],
    'medium': [
        'not working', 'malfunction', 'faulty meter', 'wrong reading',
        'overcharged', 'wrong bill', 'flickering lights', 'unstable voltage',
        'intermittent power', 'occasionally off', 'billing dispute',
    ],
}

# Words that cancel out keyword elevation (negation context).
# If any of these appear NEAR a keyword match, skip the elevation.
# NOTE: 'installation' was intentionally removed — it is too broad and
# would suppress genuine emergencies such as "fire at solar panel installation"
# or "explosion at installation site".  Routine installation requests are
# handled by the 'New Connection' category floor in CATEGORY_PRIORITY_MAP.
NEGATION_WORDS = {
    'not', 'no', 'never', 'without', "isn't", "wasn't", "didn't",
    'request for', 'inquiry about', 'asking about', 'question about',
    'new connection', 'apply for',
}

CATEGORY_PRIORITY_MAP = {
    'Safety Hazard':    'Critical',
    'Power Outage':     'High',
    'Equipment Failure':'High',
    'Industrial Supply':'High',
    'Voltage Issues':   'Medium',
    'Meter Issues':     'Medium',
    'New Connection':   'Low',
    'Street Lighting':  'Low',
    'Billing Dispute':  'Low',
    'Other':            'Medium',
}

# ============================================================
# TEXT PREPROCESSOR
# ============================================================
class TextPreprocessor:
    """Clean and normalize request text for TF-IDF feature extraction."""

    def __init__(self):
        self.stemmer    = PorterStemmer()
        self.stop_words = set(stopwords.words('english'))
        # Keep negation and intensifiers — they matter for urgency
        self.stop_words -= {'no', 'not', 'never', 'very', 'more', 'most', 'all'}

    def preprocess(self, text: str) -> str:
        if not text:
            return ''
        text   = text.lower()
        text   = re.sub(r'[^a-z0-9\s]', ' ', text)
        tokens = word_tokenize(text)
        tokens = [self.stemmer.stem(t) for t in tokens
                  if t not in self.stop_words and len(t) > 2]
        return ' '.join(tokens)

    def detect_keywords(self, text: str) -> dict:
        text_lower = text.lower()
        found = {'critical': [], 'high': [], 'medium': []}
        for level, keywords in URGENT_KEYWORDS.items():
            for kw in keywords:
                if kw not in text_lower:
                    continue
                # Check a 6-word window around the keyword for negation context
                idx = text_lower.find(kw)
                window_start = max(0, idx - 40)
                window = text_lower[window_start: idx + len(kw) + 40]
                if any(neg in window for neg in NEGATION_WORDS):
                    continue   # skip — negation/inquiry context detected
                found[level].append(kw)
        return found


preprocessor = TextPreprocessor()

# ============================================================
# TRAINING DATA
# Loads the CSV dataset first; falls back to the built-in list
# so the service still works if the file is missing.
# ============================================================
BUILTIN_TRAINING_DATA = [
    # ── Critical ────────────────────────────────────────────────────────────────
    ("Emergency hospital blackout patients on life support oxygen failing immediately", "Critical"),
    ("Transformer explosion fire burning dangerous entire market area", "Critical"),
    ("Fallen high voltage line on road shocking passers electrocuted immediate danger", "Critical"),
    ("Complete power outage hospital clinic no electricity life support machines stopping", "Critical"),
    ("Gas explosion substation fire spreading urgent emergency rescue needed now", "Critical"),
    ("Electrocution accident worker unconscious power line down immediately", "Critical"),
    ("Sparking live wires on roof children present immediate danger", "Critical"),
    ("Live wire fell on road people cannot pass electrocution risk", "Critical"),
    ("Fire started from electrical fault building burning call emergency", "Critical"),
    ("Substation caught fire thick smoke spreading to homes evacuating now", "Critical"),
    ("High voltage cable snapped hanging over road vehicles hitting it", "Critical"),
    ("Worker electrocuted by exposed wire on pole critical condition hospital", "Critical"),
    ("Electric pole fell on house people trapped roof collapsed", "Critical"),
    ("Hospital emergency ward has no power critical patients on ventilators", "Critical"),
    ("ICU unit completely dark backup generator failed patients in danger", "Critical"),

    # ── High ────────────────────────────────────────────────────────────────────
    ("Power outage entire neighborhood thousands affected since yesterday", "High"),
    ("Transformer damaged by storm large area no electricity many customers affected", "High"),
    ("Dangerous voltage fluctuations damaging appliances throughout community", "High"),
    ("Industrial factory complete power failure production stopped major loss", "High"),
    ("Street lights all off large area security risk residents afraid at night", "High"),
    ("Health center has been without power three days cannot refrigerate vaccines", "High"),
    ("Three phase supply failure entire industrial zone multiple companies affected", "High"),
    ("Water pumping station no electricity entire sector has no water", "High"),
    ("No power for five days entire village affected please send technician urgently", "High"),
    ("Voltage very high appliances burning smell damaged refrigerators TVs", "High"),
    ("Transformer burnt down entire cell without electricity since Monday", "High"),
    ("Cold storage facility losing power food spoiling business losing money daily", "High"),
    ("Multiple street lights broken dark road accidents happening at night", "High"),
    ("School has had no power for a week classes disrupted examinations affected", "High"),
    ("Mosque generator failed Friday prayer no fans no lights large congregation", "High"),
    ("Entire market no electricity vendors losing business daily many affected", "High"),
    ("Power fluctuating wildly destroying equipment workshop cannot operate", "High"),
    ("Three days without power residential block 50 families affected", "High"),

    # ── Medium ──────────────────────────────────────────────────────────────────
    ("Voltage fluctuation occasionally flickering lights tripping circuit breaker", "Medium"),
    ("Electric meter reading seems incorrect billing dispute investigation needed", "Medium"),
    ("Single phase supply unstable new equipment installation required upgrade", "Medium"),
    ("Power outage affecting residential area last few hours please investigate", "Medium"),
    ("Billing overcharged this month amount seems wrong please review account", "Medium"),
    ("Electric connection issue intermittent sometimes works sometimes does not", "Medium"),
    ("Meter malfunction showing wrong readings request inspection and calibration", "Medium"),
    ("Power cuts randomly several times a day disrupting work from home", "Medium"),
    ("My electricity bill doubled this month usage has not changed query", "Medium"),
    ("Lights flicker when I use microwave possible wiring issue in house", "Medium"),
    ("Meter prepaid token not updating after loading credit issue", "Medium"),
    ("Voltage drops when neighbors use heavy equipment problem", "Medium"),
    ("Phase failure single phase only two phases working equipment affected", "Medium"),
    ("Meter display blank cannot check units remaining need inspection", "Medium"),
    ("Power cuts every evening between 6 and 9 pm affecting cooking routine", "Medium"),
    ("Wrong account being charged neighbor has different meter number billing error", "Medium"),
    ("Circuit breaker trips frequently overloaded circuit needs upgrading", "Medium"),
    ("Prepaid meter beeping constantly low units warning even after loading", "Medium"),

    # ── Low ─────────────────────────────────────────────────────────────────────
    ("Request for new electricity connection recently built house residential", "Low"),
    ("Street light near my house not working for a week no danger", "Low"),
    ("New meter installation request for extension building", "Low"),
    ("Billing query would like to understand my consumption pattern", "Low"),
    ("Request information about prepaid meter installation costs and process", "Low"),
    ("Need to transfer account to new address residential property moving", "Low"),
    ("Single street light flickering occasionally neighbourhood still lit", "Low"),
    ("Application for new connection commercial shop ground floor", "Low"),
    ("How do I apply for a second meter for my rental units", "Low"),
    ("Request change of meter location inside house renovation", "Low"),
    ("Query about how to read my meter correctly consumption understanding", "Low"),
    ("Need electricity connection for newly built fence perimeter lighting", "Low"),
    ("Street light outside my gate off for two weeks area still has other lights", "Low"),
    ("Would like to know procedure for reconnection after debt payment", "Low"),
    ("Application for power connection for borehole pump small farm", "Low"),
    ("Request to upgrade single phase to three phase future expansion plan", "Low"),
    ("Lost prepaid meter card need replacement procedure information", "Low"),
    ("Billing address update request moved to new house same area", "Low"),
]


def load_training_data() -> list:
    """
    Load training samples from training_dataset.csv when available,
    then merge with the built-in list so we always have both sources.
    """
    data = list(BUILTIN_TRAINING_DATA)  # start with built-in

    if not os.path.exists(DATASET_PATH):
        logger.warning("training_dataset.csv not found — using built-in samples only (%d rows)", len(data))
        return data

    try:
        df = pd.read_csv(DATASET_PATH)

        # Accept either 'description'/'priority' OR a combined 'text'/'label' column
        if 'description' in df.columns and 'priority' in df.columns:
            text_col, label_col = 'description', 'priority'
        elif 'text' in df.columns and 'label' in df.columns:
            text_col, label_col = 'text', 'label'
        else:
            logger.warning("CSV missing expected columns — using built-in samples only")
            return data

        valid_labels = {'Critical', 'High', 'Medium', 'Low'}
        for _, row in df.iterrows():
            text  = str(row[text_col]).strip()
            label = str(row[label_col]).strip()
            if text and label in valid_labels:
                data.append((text, label))

        logger.info("Loaded %d total training samples (%d from CSV, %d built-in)",
                    len(data), len(data) - len(BUILTIN_TRAINING_DATA), len(BUILTIN_TRAINING_DATA))
    except Exception as exc:
        logger.error("Failed to load CSV: %s — using built-in samples only", exc)

    return data


# ============================================================
# MODEL
# ============================================================
class PriorityPredictor:
    """Ensemble ML model for request priority prediction."""

    def __init__(self):
        self.models        = {}
        self.vectorizer    = None
        self.label_encoder = LabelEncoder()
        self.label_encoder.fit(['Critical', 'High', 'Medium', 'Low'])
        self.is_trained    = False

    # ----------------------------------------------------------
    def train(self, training_data=None):
        if training_data is None:
            training_data = load_training_data()

        texts, labels = zip(*training_data)

        logger.info("Training on %d samples", len(texts))
        df = pd.DataFrame({'priority': labels})
        logger.info("Label distribution:\n%s", df['priority'].value_counts().to_string())

        self.vectorizer = TfidfVectorizer(
            max_features  = 5000,
            ngram_range   = (1, 3),
            min_df        = 1,
            max_df        = 0.95,
            sublinear_tf  = True,
            analyzer      = 'word',
            preprocessor  = preprocessor.preprocess,
        )

        processed = [preprocessor.preprocess(t) for t in texts]
        X = self.vectorizer.fit_transform(processed)
        y = self.label_encoder.transform(labels)

        lr = LogisticRegression(C=1.0, max_iter=1000, random_state=42, class_weight='balanced')
        rf = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42, class_weight='balanced')
        nb = MultinomialNB(alpha=0.1)

        lr.fit(X, y)
        rf.fit(X, y)
        nb.fit(X, y)
        self.models = {'logistic_regression': lr, 'random_forest': rf, 'naive_bayes': nb}

        # Only run cross-validation when there are enough samples for it to be meaningful
        if len(texts) >= 20:
            cv_folds = min(5, len(texts) // 4)
            for name, model in self.models.items():
                scores = cross_val_score(model, X, y, cv=cv_folds, scoring='accuracy')
                logger.info("%s CV accuracy (%d-fold): %.3f ± %.3f",
                            name, cv_folds, scores.mean(), scores.std())

        self.is_trained = True
        logger.info("Model training complete (version %s)", MODEL_VERSION)
        return self

    # ----------------------------------------------------------
    def save(self):
        """Persist trained models and vectorizer to disk."""
        os.makedirs('models', exist_ok=True)
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({
                'models':        self.models,
                'label_encoder': self.label_encoder,
                'version':       MODEL_VERSION,
            }, f)
        with open(VECTORIZER_PATH, 'wb') as f:
            pickle.dump(self.vectorizer, f)
        logger.info("Model saved to %s", MODEL_PATH)

    # ----------------------------------------------------------
    @classmethod
    def load(cls) -> 'PriorityPredictor':
        """Load a previously persisted model from disk."""
        instance = cls()
        with open(MODEL_PATH, 'rb') as f:
            data = pickle.load(f)
        with open(VECTORIZER_PATH, 'rb') as f:
            instance.vectorizer = pickle.load(f)
        instance.models        = data['models']
        instance.label_encoder = data['label_encoder']
        instance.is_trained    = True
        logger.info("Model loaded from disk (version %s)", data.get('version', 'unknown'))
        return instance

    # ----------------------------------------------------------
    def predict(self, text: str, category: str = None) -> dict:
        start_time = time.time()

        if not self.is_trained:
            self.train()

        keywords  = preprocessor.detect_keywords(text)
        all_found = keywords['critical'] + keywords['high'] + keywords['medium']

        processed = preprocessor.preprocess(text)
        X         = self.vectorizer.transform([processed])

        scores     = {}
        proba_list = []

        for name, model in self.models.items():
            pred_idx    = model.predict(X)[0]
            pred_label  = self.label_encoder.inverse_transform([pred_idx])[0]
            proba       = model.predict_proba(X)[0]
            model_lbls  = [self.label_encoder.inverse_transform([i])[0] for i in range(len(proba))]
            proba_aligned = {lbl: float(p) for lbl, p in zip(model_lbls, proba)}
            scores[name]  = {'prediction': pred_label, 'probabilities': proba_aligned}
            proba_list.append(proba)

        avg_proba     = np.mean(proba_list, axis=0)
        pred_idx      = np.argmax(avg_proba)
        base_priority = self.label_encoder.inverse_transform([pred_idx])[0]
        base_conf     = float(avg_proba[pred_idx])

        # Keyword-based elevation
        priority_order = {'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3}
        final_priority = base_priority
        final_conf     = base_conf

        if keywords['critical'] and priority_order[final_priority] < priority_order['Critical']:
            final_priority = 'Critical'
            final_conf     = max(0.90, final_conf + 0.15)
            logger.info("Priority elevated to Critical by keywords: %s", keywords['critical'])
        elif keywords['high'] and priority_order[final_priority] < priority_order['High']:
            final_priority = 'High'
            final_conf     = max(0.82, final_conf + 0.10)

        # Category-based floor
        if category and category in CATEGORY_PRIORITY_MAP:
            cat_priority = CATEGORY_PRIORITY_MAP[category]
            if priority_order[cat_priority] > priority_order[final_priority]:
                final_priority = cat_priority
                final_conf     = max(0.75, final_conf)

        final_conf = min(0.99, final_conf)

        processing_ms = int((time.time() - start_time) * 1000)

        # Top TF-IDF feature words for explainability
        top_features: list[str] = []
        try:
            feature_names = self.vectorizer.get_feature_names_out()
            tfidf_scores  = X.toarray()[0]
            top_idx       = tfidf_scores.argsort()[-8:][::-1]
            top_features  = [feature_names[i] for i in top_idx if tfidf_scores[i] > 0]
        except Exception:
            pass

        return {
            # ── Fields read directly by the Java service ──────────────────
            'priority':          final_priority,
            'confidence':        round(final_conf, 4),
            'keywords_detected': all_found,
            'is_uncertain':      final_conf < 0.60,   # flag for UI warning
            'model_scores': {
                'logistic_regression': scores['logistic_regression']['probabilities'].get(final_priority, 0),
                'random_forest':       scores['random_forest']['probabilities'].get(final_priority, 0),
                'naive_bayes':         scores['naive_bayes']['probabilities'].get(final_priority, 0),
            },
            'all_probabilities': {
                label: round(float(avg_proba[i]), 4)
                for i, label in enumerate(self.label_encoder.classes_)
            },
            # ── Explainability ─────────────────────────────────────────────
            'top_features':      top_features,        # top TF-IDF words used
            # ── Extra diagnostic fields ───────────────────────────────────
            'confidence_pct':    round(final_conf * 100, 1),
            'base_prediction':   base_priority,
            'priority_elevated': final_priority != base_priority,
            'model_version':     MODEL_VERSION,
            'processing_ms':     processing_ms,
        }

    # ----------------------------------------------------------
    def get_metrics(self) -> dict:
        return {
            'model_version':    MODEL_VERSION,
            'training_samples': len(load_training_data()),
            'classes':          list(self.label_encoder.classes_),
            'algorithms':       ['TF-IDF', 'Logistic Regression', 'Random Forest', 'Naive Bayes'],
            'ensemble_method':  'Soft voting (probability averaging)',
        }


# ============================================================
# INITIALIZE — load from disk if available, otherwise train.
# VERSION CHECK: if the saved model was built with an older
# MODEL_VERSION, discard it and retrain so code + model stay in sync.
# To force a full retrain (e.g. after adding training data),
# bump MODEL_VERSION above.
# ============================================================
def init_predictor() -> PriorityPredictor:
    if os.path.exists(MODEL_PATH) and os.path.exists(VECTORIZER_PATH):
        try:
            with open(MODEL_PATH, 'rb') as f:
                saved_data = pickle.load(f)

            saved_version = saved_data.get('version', 'unknown')
            if saved_version != MODEL_VERSION:
                logger.info(
                    "Model version mismatch (saved=%s, current=%s) — retraining with current data",
                    saved_version, MODEL_VERSION,
                )
            else:
                # Version matches — restore fully without retraining
                p = PriorityPredictor()
                with open(VECTORIZER_PATH, 'rb') as f:
                    p.vectorizer = pickle.load(f)
                p.models        = saved_data['models']
                p.label_encoder = saved_data['label_encoder']
                p.is_trained    = True
                logger.info("Loaded existing model from disk (version %s)", MODEL_VERSION)
                return p
        except Exception as exc:
            logger.warning("Could not load saved model (%s) — retraining", exc)

    logger.info("No saved model found — training from scratch")
    p = PriorityPredictor()
    p.train()
    p.save()
    return p


predictor = init_predictor()


# ============================================================
# RATE LIMITER  (fixed-window, per IP)
# ============================================================
# Buckets: { ip: [timestamp, ...] }  — timestamps within the current window
_rate_buckets: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_REQUESTS = 30    # max calls per IP
RATE_LIMIT_WINDOW   = 60.0  # seconds


def _is_rate_limited(ip: str) -> bool:
    """Return True if the IP has exceeded the rate limit for this window."""
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW
    bucket = _rate_buckets[ip]
    # Evict expired timestamps
    _rate_buckets[ip] = [t for t in bucket if t > cutoff]
    if len(_rate_buckets[ip]) >= RATE_LIMIT_REQUESTS:
        return True
    _rate_buckets[ip].append(now)
    return False


def client_ip() -> str:
    forwarded = request.headers.get('X-Forwarded-For', '')
    return forwarded.split(',')[0].strip() if forwarded else (request.remote_addr or 'unknown')


# ============================================================
# API ROUTES
# ============================================================
@app.route('/api/predict', methods=['POST'])
def predict():
    """
    POST /api/predict
    Body:    { "title": str, "description": str, "category": str }
    Returns: flat prediction object (no wrapper) so Java can read fields directly.
    """
    if _is_rate_limited(client_ip()):
        logger.warning("Rate limit hit for IP %s on /api/predict", client_ip())
        return jsonify({'error': 'Too many requests. Please wait before trying again.'}), 429

    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON body required'}), 400

        title       = data.get('title',       '').strip()
        description = data.get('description', '').strip()
        category    = data.get('category',    '').strip()

        if not title and not description:
            return jsonify({'error': 'title or description is required'}), 400

        combined = f"{title}. {description}".strip()
        result   = predictor.predict(combined, category)

        # Return result FLAT — no {success, data, timestamp} wrapper.
        # The Java AiPredictionService reads fields at the top level.
        return jsonify(result)

    except Exception as exc:
        logger.error("Prediction error: %s", exc, exc_info=True)
        return jsonify({'error': 'Prediction failed', 'message': str(exc)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status':        'ok',
        'model_version': MODEL_VERSION,
        'model_trained': predictor.is_trained,
        'timestamp':     datetime.utcnow().isoformat(),
    })


@app.route('/api/model/metrics', methods=['GET'])
def model_metrics():
    return jsonify({'success': True, 'data': predictor.get_metrics()})


@app.route('/api/predict/batch', methods=['POST'])
def predict_batch():
    """
    POST /api/predict/batch
    Body:    { "requests": [{ "id": any, "title": str, "description": str, "category": str }, ...] }
    Returns: { "success": true, "data": [...predictions with id echoed back...], "count": N }

    Processes up to MAX_BATCH_SIZE items per call (extras are silently dropped).
    Intended for bulk AI re-scoring of existing requests (e.g. after a model retrain).
    The Java AiPredictionService calls /api/predict for single predictions; this
    endpoint is available for future batch-retrain or admin tooling use.
    """
    try:
        data     = request.get_json()
        if not data:
            return jsonify({'error': 'JSON body required'}), 400
        items    = data.get('requests', [])
        if not items:
            return jsonify({'error': 'requests array required'}), 400

        results = []
        for req in items[:MAX_BATCH_SIZE]:
            text   = f"{req.get('title', '')}. {req.get('description', '')}".strip()
            result = predictor.predict(text, req.get('category', ''))
            results.append({'id': req.get('id'), **result})

        return jsonify({'success': True, 'data': results, 'count': len(results)})

    except Exception as exc:
        logger.error("Batch prediction error: %s", exc, exc_info=True)
        return jsonify({'error': 'Batch prediction failed'}), 500


@app.route('/api/model/retrain', methods=['POST'])
def retrain():
    """
    POST /api/model/retrain
    Optionally accepts { "training_data": [{"text": ..., "label": ...}] }
    to append ground-truth samples from resolved requests.
    """
    try:
        data     = request.get_json() or {}
        new_data = data.get('training_data', [])
        base     = load_training_data()

        if new_data:
            combined = base + [(d['text'], d['label']) for d in new_data]
        else:
            combined = base

        predictor.train(combined)
        predictor.save()
        return jsonify({'success': True,
                        'message': f'Model retrained on {len(combined)} samples and saved to disk'})

    except Exception as exc:
        logger.error("Retrain error: %s", exc, exc_info=True)
        return jsonify({'error': 'Retrain failed'}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405


# ============================================================
# MAIN
# ============================================================
if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'train':
        # python ai_api.py train  — force retrain and save
        p = PriorityPredictor()
        p.train()
        p.save()
        texts, labels = zip(*load_training_data())
        processed = [preprocessor.preprocess(t) for t in texts]
        X = p.vectorizer.transform(processed)
        y = p.label_encoder.transform(labels)
        for name, model in p.models.items():
            y_pred = model.predict(X)
            print(f"\n=== {name} ===")
            print(classification_report(y, y_pred, target_names=p.label_encoder.classes_))
    else:
        print("REG AI Prediction API  →  http://localhost:5000")
        print("  POST /api/predict        single prediction")
        print("  POST /api/predict/batch  batch predictions")
        print("  GET  /api/health         health check")
        print("  GET  /api/model/metrics  model info")
        print("  POST /api/model/retrain  retrain + save")
        app.run(debug=True, host='0.0.0.0', port=5000)
